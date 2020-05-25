package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
)

var isCache bool

func init() {
	log.SetFlags(log.Llongfile)
}

//自建缓存，目的和功效：降低至磁盘IO（包含任何文本图片等静态资源）为1次；js,css,html的链接，编译，为1次；
//用空间换时间
//数据结构：
type cacheItem struct {
	Type   string
	Length string
	Body   []byte
}

var cacheServer = make(map[string]cacheItem)

var sw float64
var sh float64

func main() {
	addr := flag.String("addr", ":50003", "服务器端口")
	cache := flag.Bool("cache", false, "缓存")
	smartWidth := flag.Float64("smartWidth", 750, "基准宽度")
	smartHeight := flag.Float64("smartHeight", 1334, "基准高度")

	flag.Parse()
	isCache = *cache

	sw = 100.0 / *smartWidth
	sh = 100.0 / *smartHeight

	//静态资源服
	http.Handle("/resource/",
		http.StripPrefix("/resource/", setHeaderHandler(
			es6toes5Handler(
				http.FileServer(
					http.Dir("./root/resource"))))))

	//页面和模块内静态资源，主要是图片
	http.Handle("/page/",
		http.StripPrefix("/page/",
			setHeaderHandler(
				http.FileServer(http.Dir("./root/page")))))

	//动态页面路由
	http.Handle("/",
		setHeaderHandler(
			makeFileHandler()))

	//服务
	log.Fatal(http.ListenAndServe(*addr, nil))

}

//设置头的中间件
func setHeaderHandler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cacheHeader(w)
		h.ServeHTTP(w, r)
	})
}

//es6转es5的中间件
func es6toes5Handler(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		urlPath := r.URL.Path
		//自动转脚本
		if isIE(r.Header.Get("User-Agent")) && strings.HasPrefix(urlPath, "script/") {
			scriptPath := "./root/resource/" + urlPath
			if !existsAndWrite(scriptPath, w) {
				return
			}
			script, err := ioutil.ReadFile(scriptPath)
			if err != nil {
				log.Println(err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			//log.Println( string(script))

			cmd := exec.Command("node", "babel", string(script))
			//cmd := exec.Command("node", "babel", "let a =1;")
			out, err := cmd.CombinedOutput()
			if err != nil {
				log.Println(err)
				w.WriteHeader(http.StatusInternalServerError)
				return
			}
			//log.Println(string(out))
			httpWriteAndCache(w, urlPath, "application/javascript", out)
			return
			//结束中间件
		}
		//普通的静态服务
		h.ServeHTTP(w, r)
	})
}

//组装文件的中间件，最后一层
func makeFileHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		urlPath := r.URL.Path

		//判断缓存
		if value, ok := cacheServer[urlPath]; ok {
			httpWrite(w, &value)
			return
		}

		//转发到resource处理器
		if urlPath == "/favicon.ico" {
			http.Redirect(w, r, "/resource/image/favicon.ico", http.StatusFound)
			return
		}

		if urlPath == "/" {
			urlPath = "/index"
		}
		//page
		//page := "./root/page" + urlPath
		if !existsAndWrite("./root/page"+urlPath, w) {
			return
		}

		//resource
		resource := "./root/resource"
		if !existsAndWrite(resource, w) {
			return
		}
		makeFile(urlPath, resource, w, isIE(r.Header.Get("User-Agent")))
	})
}

func cacheHeader(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Credentials", "true")
	w.Header().Set("Access-Control-Allow-Methods", "*")
	w.Header().Set("Access-Control-Allow-Headers", "*")
}

func existsAndWrite(ckPath string, w http.ResponseWriter) bool {
	_, err := os.Stat(ckPath)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		log.Printf("not found : %s", ckPath)
		return os.IsExist(err)
	}
	return true
}

func exists(ckPath string) bool {
	_, err := os.Stat(ckPath)
	if err != nil {
		return os.IsExist(err)
	}
	return true
}

//组装文件，带缓存
func makeFile(pPath, resource string, w http.ResponseWriter, isIE bool) {
	page := "./root/page" + pPath
	//查找主要文件
	appPath := page + "/app.html"
	if !existsAndWrite(appPath, w) {
		return
	}
	appMain, err := ioutil.ReadFile(appPath)
	if err != nil {
		log.Printf("read err : %s", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	appHtml := string(appMain)
	//=== 解析 ===
	//解析 entry属性
	entryReg := regexp.MustCompile(`entry=['"]?([^'"]*)['"]?`)
	//解析 id属性
	idReg := regexp.MustCompile(`id=['"]?([^'"]*)['"]?`)
	//解析 class属性
	classReg := regexp.MustCompile(`class=['"]?([^'"]*)['"]?`)
	//解析 scope属性
	scopeReg := regexp.MustCompile(`scope=['"]?([^'"]*)['"]?`)

	//=== 编译 ===
	//编译主style
	moduleStyleCompiler(page, "", pPath, "", &appHtml)

	//编译主script
	moduleScriptCompiler(page, "", &appHtml)

	//编译图片
	moduleImgTagCompiler("", pPath, "", &appHtml)
	//模块html
	for _, param := range regexp.MustCompile(`<module.*?(?:>|/>)`).FindAllStringSubmatch(appHtml, -1) {
		//模块
		moduleTag := param[0]
		//entry
		entryMatch := entryReg.FindStringSubmatch(moduleTag)
		if len(entryMatch) != 2 {
			log.Println("entry属性缺失")
			continue
		}
		entry := entryMatch[1]
		if entry == "" {
			log.Println("entry属性为空")
			continue
		}

		//class
		class := ""
		classMatch := classReg.FindStringSubmatch(moduleTag)
		if len(classMatch) == 2 {
			if classMatch[1] != "" {
				class = fmt.Sprintf(` class="%s"`, classMatch[1])
			}
		}

		//scope
		scope := ""
		scopeMatch := scopeReg.FindStringSubmatch(moduleTag)
		if len(scopeMatch) == 2 {
			if scopeMatch[1] != "" {
				scope = scopeMatch[1]
			}
		}

		/*log.Println("entry ==>", entry)
		log.Println("class ==>", class)
		log.Println("scope ==>", scope)*/

		//模块
		entryPath := page + "/module/" + entry

		//公共资源
		if scope != "" {
			entryPath = resource + "/module/" + entry
		}

		//id
		idMatch := idReg.FindStringSubmatch(moduleTag)
		if len(idMatch) == 2 {
			if idMatch[1] != "" {
				entry = idMatch[1]
			}
		}

		//编译html
		moduleHtmlCompiler(entryPath, entry, moduleTag, class, &appHtml)

		//编译style
		moduleStyleCompiler(entryPath, scope, pPath, entry, &appHtml)

		//编译script
		moduleScriptCompiler(entryPath, entry, &appHtml)

		//编译图片
		moduleImgTagCompiler(scope, pPath, entry, &appHtml)
	}

	//压缩

	if isIE {
		//es6编译es5
		es6toes5(&appHtml)
		//polyfill-js
		polyfillJS(&appHtml)
		//polyfill-css
		polyfillCSS(&appHtml)
	}

	//混淆
	data := []byte(appHtml)
	httpWriteAndCache(w, pPath, "text/html", data)
}

func es6toes5(appHtml *string) {
	//提取所有<script></script>之间的js
	//scriptReg := regexp.MustCompile(`<script(?s:(.*?))>(\S)</script>`)
	scriptReg := regexp.MustCompile(`<script>([\s\S]*)</script>`)
	*appHtml = scriptReg.ReplaceAllStringFunc(*appHtml, func(s string) string {
		script := scriptReg.FindStringSubmatch(s)[1]
		//编译es5
		cmd := exec.Command("node", "babel", script)
		out, err := cmd.CombinedOutput()
		if err != nil {
			log.Println(err)
		}
		return fmt.Sprintf("<script>%s</script>", out)
	})
}

//动态增加垫片库
func polyfillJS(appHtml *string) {
	//替换掉第一个<script>
	//自己开发的的polyfill
	*appHtml = strings.Replace(*appHtml, "<script", `<script src="/resource/lib/polyfill/myPolyfill.js"></script>
<script`, 1)

	//====动态引入
	//https://polyfill.io/v3/url-builder/的polyfill
	var features = [...]string{
		"Map",
		"Set",
		"document.currentScript",
	}
	polyfillIo := fmt.Sprintf("https://polyfill.io/v3/polyfill.min.js?features=%s",
		strings.Join(features[:], "%2C"))
	//log.Println(polyfillIo)
	*appHtml = strings.Replace(*appHtml,
		"<script", fmt.Sprintf(`<script src="%s"></script><script`, polyfillIo), 1)
	//======

}

func polyfillCSS(appHtml *string) {

}

//输出并缓存
func httpWriteAndCache(w http.ResponseWriter, urlPath, contentType string, body []byte) {
	//缓存
	cache := cacheItem{
		contentType,
		strconv.Itoa(len(body)),
		body,
	}
	if isCache {
		cacheServer[urlPath] = cache
	}
	//输出
	httpWrite(w, &cache)
}

//输出
func httpWrite(w http.ResponseWriter, cache *cacheItem) {
	w.Header().Set("Content-Type", cache.Type)
	w.Header().Set("Content-Length", cache.Length)
	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Expires", "0")
	_, err := w.Write(cache.Body)
	if err != nil {
		log.Println(err)
	}
}

//html
func moduleHtmlCompiler(entryPath, entry, moduleTag, class string, appHtml *string) {
	htmlPath := entryPath + "/app.html"
	if exists(htmlPath) {
		data, err := ioutil.ReadFile(htmlPath)
		if err != nil {
			log.Printf("%s read fail, %s", htmlPath, err)
			return
		} else {
			appHtmlStr := strings.ReplaceAll(*appHtml, moduleTag, fmt.Sprintf(`<div id="%s"%s>%s</div>`, entry, class, string(data)))
			//=====去掉缓存
			//t := time.Now().Unix()
			//appHtmlStr = strings.ReplaceAll(appHtmlStr, `.css">`, fmt.Sprintf(`.css?t=%d">`, t))
			//appHtmlStr = strings.ReplaceAll(appHtmlStr, `.js">`, fmt.Sprintf(`.js?t=%d">`, t))
			//=====

			*appHtml = appHtmlStr
			return
		}
	} else {
		log.Printf("%s not found", htmlPath)
		return
	}
}

//style
func moduleStyleCompiler(entryPath, scope, pagePath, entry string, appHtml *string) {
	var stylePath string
	if scope != "" { //公共模块
		stylePath = "./root/resource/module/" + strings.Split(entryPath, "module/")[1]
	} else {
		if entry != "" { //子模块
			stylePath = entryPath
		} else { //主模块
			stylePath = "./root/page" + pagePath
		}
	}

	stylePath += "/style.css"

	if exists(stylePath) {
		data, err := ioutil.ReadFile(stylePath)
		if err != nil {
			log.Printf("%s read fail, %s", stylePath, err)
			return
		} else {
			str := string(data)

			//单位转换
			swPat := `\d{1,}sw`
			shPat := `\d{1,}sh`
			swPatRe := regexp.MustCompile(swPat)
			shPatRe := regexp.MustCompile(shPat)
			str = swPatRe.ReplaceAllStringFunc(str, func(s string) string {
				return replaceSmartUnit(s, "sw", "vw", sw)
			})
			str = shPatRe.ReplaceAllStringFunc(str, func(s string) string {
				return replaceSmartUnit(s, "sh", "vh", sh)
			})

			if str == "" && entry == "" {
				*appHtml = strings.Replace(*appHtml, "</head>", "<style></style></head>", 1)
				return
			}

			arr := strings.Split(str, "}")
			newStr := ""
			for _, v := range arr {
				if v == "" {
					continue
				}

				brr := strings.Split(v, "{")
				if len(brr) != 2 {
					continue
				}

				if entry != "" {
					//子模块
					//limitPrefix =
					name := ""
					crr := strings.Split(brr[0], ",")
					for _, cv := range crr {
						cv = strings.Trim(cv, "\n")
						cv = strings.Trim(cv, " ")
						name += "#" + entry
						if cv != "DOMAIN" {
							//if strings.Contains(cv, "DOMAIN.") {
							if strings.HasPrefix(cv, "DOMAIN.") {
								name += "." + strings.Split(cv, ".")[1]
							} else {
								name += ">" + cv + ","
							}

						}
					}
					name = strings.TrimRight(name, ",")

					newStr += name + "{" + brr[1] + "}"
				} else {
					//主模块中的css
					newStr += brr[0] + "{" + brr[1] + "}"
				}
			}
			lastStyleIndex := strings.LastIndex(*appHtml, "</style>")

			if lastStyleIndex == -1 {
				//没有</style>,替换</head>
				*appHtml = strings.Replace(*appHtml, "</head>", "<style>"+newStr+"</style></head>", 1)
			} else {
				//替换最后一个</style>
				*appHtml = strings.Replace(*appHtml, "</style>", newStr+"</style>", 1)
			}
			return
		}
	} else {
		log.Printf("%s not found", stylePath)
		return
	}

}

//script
func moduleScriptCompiler(entryPath, entry string, appHtml *string) {
	scriptPath := entryPath + "/script.js"
	if exists(scriptPath) {
		data, err := ioutil.ReadFile(scriptPath)
		if err != nil {
			log.Printf("%s read fail, %s", scriptPath, err)
			return
		} else {
			str := string(data)
			if str == "" {
				log.Printf("%s is empty", scriptPath)
				return
			}

			classReg, err := regexp.Compile("class (\\S*) {")
			if err != nil {
				log.Println(err)
				return
			}

			//子模块的script
			if entry != "" {
				//简化书写调用模块
				str = strings.ReplaceAll(str, "MODULE", "this.APP.getModule")
				str = strings.ReplaceAll(str, "DOMAIN", "this.DOMAIN")
				str = strings.ReplaceAll(str, "NAME", "this.NAME")
				str = strings.ReplaceAll(str, "SUPER", "this.APP")
				//构造
				str = classReg.ReplaceAllString(str, `
				;app.setModule("`+entry+`",new class{
            		constructor(APP, DOMAIN) {
                		this.APP = APP;
                		this.DOMAIN = DOMAIN;
                		this.NAME = "`+entry+`";
                		this.DOM();
                		this.INIT();
                		this.EVENT();
            	}`)
				str += `(app,document.querySelector("#` + entry + `")))`
			} else {
				//主模块
				//简化书写调用模块
				str = strings.ReplaceAll(str, "MODULE", "this.getModule")
				str = strings.ReplaceAll(str, "DOMAIN", "this.DOMAIN")
				//主模块的script
				str = classReg.ReplaceAllString(str, `
				document.addEventListener("DOMContentLoaded", () => {
					const app = new class{
						constructor() {
							this.moduleMap = new Map();
							this.DOMAIN = document.body;
							this.DOM();
							this.INIT();
							this.EVENT();
						}
						getModule(moduleName) {
							return this.moduleMap.get(moduleName);
						}
						setModule(moduleName, module) {
							this.moduleMap.set(moduleName, module);
						}
						destroyModule(moduleName) {
							let module = this.getModule(moduleName);
							module.destroy();
							this.moduleMap.delete(moduleName);
						}
						reloadModule(name = null) {
							name ? this.getModule(name).init()
								: this.moduleMap.forEach(v => v.init && v.init());
						}`)
				str += "()"
			}

			endStr := ";app.READY && app.READY();})</script>"

			//
			if strings.LastIndex(*appHtml, "</script></head>") == -1 {
				//没有</script>,替换</head>
				*appHtml = strings.Replace(*appHtml, "</head>", "<script>"+str+endStr+"</head>", 1)
			} else {
				//替换最后一个</script>
				*appHtml = strings.Replace(*appHtml, endStr, str+endStr, 1)
			}
			return
		}
	} else {
		log.Printf("%s not found", scriptPath)
		return
	}

}

//image
func moduleImgTagCompiler(scope, pagePath, entry string, appHtml *string) {
	//标签
	//img
	imgReg := regexp.MustCompile(`<img.*?(?:>|/>)`)
	//解析 src 属性
	srcReg := regexp.MustCompile(`src=['"]?([^'"]*)['"]?`)
	//提取了img标签
	for _, param := range imgReg.FindAllStringSubmatch(*appHtml, -1) {
		imgTag := param[0]
		srcMatch := srcReg.FindStringSubmatch(imgTag)
		if len(srcMatch) == 2 {
			src := srcMatch[1]
			if src != "" {
				if strings.HasPrefix(src, "/resource/image/") ||
					strings.HasPrefix(src, "http://") ||
					strings.HasPrefix(src, "https://") ||
					strings.HasPrefix(src, "file://") {
					continue
				}

				if strings.HasPrefix(src, "/image/") {
					*appHtml = strings.ReplaceAll(*appHtml, imgTag, strings.Replace(imgTag, src, "/page"+pagePath+src, 1))
				} else if entry != "" && strings.HasPrefix(src, "image/") {
					var realSrc string
					if scope != "" {
						realSrc = "/resource/module/" + entry + "/" + src
					} else {
						realSrc = "/page" + pagePath + "/module/" + entry + "/" + src
					}
					*appHtml = strings.ReplaceAll(*appHtml, imgTag, strings.Replace(imgTag, src, realSrc, 1))
				}
			}
		}
	}
	//url("xxx")
	//提取了background
	backgroundReg := regexp.MustCompile(`.*background[^;"]+url\(([^)]+)\).*`)
	urlReg := regexp.MustCompile(`url\(['".]?([^'".]*)['".]\)?`)
	for _, param := range backgroundReg.FindAllStringSubmatch(*appHtml, -1) {
		bgItem := param[0]
		urlMatch := urlReg.FindStringSubmatch(bgItem)
		if len(urlMatch) == 2 {
			url := urlMatch[1]
			if url != "" {
				if strings.HasPrefix(url, "/resource/image/") ||
					strings.HasPrefix(url, "http://") ||
					strings.HasPrefix(url, "https://") ||
					strings.HasPrefix(url, "file://") {
					continue
				}
				if strings.HasPrefix(url, "/image/") {
					*appHtml = strings.ReplaceAll(*appHtml, bgItem, strings.Replace(bgItem, url, "/page"+pagePath+url, 1))
				} else if strings.HasPrefix(url, "image/") {
					var realUrl string
					if scope != "" {
						realUrl = "/resource/module/" + entry + "/" + url
					} else {
						realUrl = "/page" + pagePath + "/module/" + entry + "/" + url
					}
					*appHtml = strings.ReplaceAll(*appHtml, bgItem, strings.Replace(bgItem, url, realUrl, 1))
				}
			}
		}
	}
}

func isIE(userAgent string) bool {
	return strings.Contains(userAgent, "Trident")
}

func replaceSmartUnit(s, su1, su2 string, size float64) string {
	s = strings.Replace(s, " ", "", -1)
	s = strings.Replace(s, su1, "", -1)
	f, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return `: 0;`
	}
	return fmt.Sprintf(` %.1f%s`, f*size, su2)
}