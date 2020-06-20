/**
 * 基类 采用ES6实现
 *  包含
 *      1、实用方法，
 *      2、ajax，
 *      3、事件绑定，
 *      4、数据绑定（未实现数据双向绑定），
 *      5、面向对象风格框架，private、public特性，多例，无new使用
 *      6、模块化，模块缓存，模块调度
 *      7、style和link劫持，
 *      8、svg操作，
 *      9、用户行为采集（未实现），
 *      10、日志监控
 * 需要实现
 *    session 参数
 *    屏蔽css攻击，css()函数做检测，上传的时候做检测
 *    支持本地存储
 *    websocket
 *    click和change实现代理blur和focus。封装drag拖拽事件
 *    扩展empty(),清空的时候遍历一遍事件树，被清空的节点在事件树上就销毁事件
 *    加载插件的时候，保存在storage里，带版本号，下次用的时候，先查storage里面有没有，要维护更新和删除，图片，css,也存一下
 *    html5的离线应用
 *    用websocket实现的不定时长的超级http
 *    监听元素大小等的变化
 */
//在线压缩
//https://skalman.github.io/UglifyJS-online/
'use strict';

//浏览器检测
class Cp {
    constructor() {
        this._origin = document.location.origin;
        //this.endebug();
        /**
         * 是否加载完成
         * @type {boolean}
         * @private
         */
        this._isReady = false;

        /**
         * 用于保存加载的的js脚本
         * @type {Set<any>}
         * @private
         */
        this._scriptSet = new Set();

        /**
         * 用于保存加载的的json
         * @type {Map<any, any>}
         * @private
         */
        this._JSONMap = new Map();

        /**
         * 用于保存模块
         * @type {Map<any, any>}
         * @private
         */
        this._moduleStack = new Map();

        /**
         * 用于obj绑定数据，当节点删除数据自动删除
         * @type {WeakMap<object, any>}
         * @private
         */
        //this._weakDate = new WeakMap();

        /**
         * 用于保存事件
         * @type {WeakMap<object, any>}
         * @private
         */
        this._domEvent = new Map();

        /**
         * 用于记录绑定的事件
         * @type {Set<any>}
         */
        //this._eventSet = new Set();

        /**
         * 用于储存绑定的事件，事件均脱强制使用body代理
         * @type {Map<any, any>}
         */
        this._eventMap = new Map();

        this._global = new Map();

        /**
         * 加载组件
         * 会在全局范围内记录使用的组件，不会发出重复请求
         * @type {any}
         */
        window.NEW = this._require.bind(this);

        /**
         * 同步加载组件
         * 会在全局范围内记录使用的组件，不会发出重复请求
         * @type {any}
         */
        window.NEW_ASYNC = this._requireAsync.bind(this);

        /**
         * 定义组件
         * @type {any}
         */
        window.CLASS = this._define.bind(this);
        this._head = document.head;
        if (document.styleSheets.length <= 0)
            this.append(this._head, this.createDom('style'));//创建style节点
        else {
            this._firstSheet = document.styleSheets.item(0);
            if (this._firstSheet.href && !this._firstSheet.href.startsWith(this._origin)) {
                this.appendTo(this._head, this.createDom('style'),-1);//创建style节点
            }
        }
        this._firstSheet = document.styleSheets.item(0);

        this._lastSheet = document.styleSheets.item(document.styleSheets.length - 1);

        this.formatStyle();
    }

    setClipboard(dom) {
        dom.select();
        document.execCommand("Copy");
    }

    forbiddenMenu() {
        window.oncontextmenu = function (event) {
            event.preventDefault();
            event.stopPropagation();
            return false;
        };
    }

    /**
     * 添加类名
     * @param dom
     * @param clazz
     */
    addClass(dom, clazz) {
        if (!clazz) {
            return dom;
        }
        dom.length !== undefined
            ? dom.forEach(vd => Array.isArray(clazz)
            ? clazz.forEach(v => vd.classList.add(v))
            : vd.classList.add(clazz))
            : Array.isArray(clazz)
            ? clazz.forEach(v => dom.classList.add(v))
            : dom.classList.add(clazz);
        return dom;
    }

    setError(dom) {
        this.addClass(dom, "error")
    }

    removeError(dom) {
        this.removeClass(dom, "error")
    }

    global() {
        return this._global
    }

    /**
     * @param url :必填参数
     * @param method :GET,POST(默认)
     * @param headers :自己查http协议去
     * @param mode :same-origin,cors(默认),cors-with-forced-preflight,no-cors
     * @param data :{}
     * @param success
     * @param error
     */
    ajax(url, {
        async = true,
        method = 'POST',
        headers = null,
        data = {},
        success = null,
        status = null,
        error = null
    } = {}) {
        if (headers === null) {
            headers = {
                //TODO 需要完善 可以参考jQuery的ajax请求头
                "Content-type": "application/x-www-form-urlencoded"
            }
        }
        headers["cache-control"] = "no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0";

        if (ajaxRequestRoot && !url.startsWith("http")) {
            url = ajaxRequestRoot + url
        }

        //头拦截器
        if (ajaxHeadersInterceptor !== null) {
            if (typeof ajaxHeadersInterceptor === "function") {
                headers = ajaxHeadersInterceptor(url);
            } else {
                headers = ajaxHeadersInterceptor;
            }
        }

        let sendData = "";
        if (method === 'GET') {
            if (data) {
                let queryArgs = '';
                Object.keys(data).forEach(value => queryArgs += value + '=' + encodeURIComponent(data[value]) + '&');
                queryArgs && (url += '?' + this.trim(queryArgs, {
                    char: '&',
                    position: 'right'
                }));
            }
            data = null
        } else {
            //将用户输入值序列化成字符串
            sendData = data && JSON.stringify(data);
            headers["Content-type"] = 'application/json';
            //headers["Content-Length"] = sendData.length;
        }

        let xhr = new XMLHttpRequest();
        xhr.open(method, url, async);

        if (headers) {
            Object.keys(headers).forEach(key => xhr.setRequestHeader(key, headers[key]));
        }

        xhr.onreadystatechange = function () {
            if (typeof status === 'function') status(xhr.status);
            if (xhr.readyState === 4) {
                let json = {};
                try {
                    json = JSON.parse(xhr.responseText)
                } catch (e) {
                    console.error(e);
                    if (typeof error === 'function') error(e);
                    return
                }
                if (typeof ajaxResponseInterceptor === "function") {
                    json = ajaxResponseInterceptor(json);
                }
                if (typeof success === 'function') success(json)
            }
        };
        xhr.send(sendData);
    }


    /**
     * 在父元素的指定位置插入元素
     * @param obj
     * @param child
     * @param index -1则在最后插入
     */
    append(obj, child, index = -1) {
        if (child) {
            let children = obj.children;
            (index < 0 || index > children.length) ? obj.appendChild(child) : obj.insertBefore(child, children[index]);
        }
        return obj;
    }

    /**
     *
     * @param obj
     * @param children
     */
    appendBatch(obj, children = []) {
        children.forEach(v => this.append(obj, v));
        return obj;
    }

    /**
     * 获取数组最大最小值
     * @param arr 数字数组
     * @param type 默认max min
     * @param index 时是否返回索引
     * @returns {number}
     */
    arrMaxMin(arr, type = 'max', index = false) {
        try {
            let value = type === 'max'
                ? Math.max(...arr)
                : Math.min(...arr);

            if (index) {
                let index = type === 'max'
                    ? arr.indexOf(Math.max.apply(Math, arr))
                    : arr.indexOf(Math.min.apply(Math, arr));
                return {value: value, index: index}
            } else {
                return value;
            }
        } catch (err) {
            ejs.log('数组太长，超过了最大调用堆栈大小，建议后端处理。此处递归对个数组进行了分段分层处理这，但将有损速度和性能', 'warn');
            let tempArr = [],
                i = 0;
            do tempArr.push(this.arrMaxMin(arr.slice(i, i += 10000), type, index));
            while (i < arr.length);
            return this.arrMaxMin(tempArr, type, index);
        }
    }

    /**
     * 深度合并和拷贝对象，建议obj2为少的一方
     * @param obj
     * @param obj2
     * @returns {*}
     */
    assignDeep(obj, obj2) {
        for (let k in obj2)
            typeof obj2[k] === 'object'
                ? obj[k] === undefined
                ? obj[k] = obj2[k]
                : this.assignDeep(obj[k], obj2[k])
                : obj[k] = obj2[k];
        return obj;
    }

    /**
     * 设置和获取属性
     * @param obj 对象
     * @param attr 属性键值对
     */
    attr(obj, attr = null) {
        if (!obj)
            return obj;
        if (attr === null) {
            let attrObj = {};
            Array.from(obj.attributes).forEach(v => v.name === 'style' ? null : attrObj[v.name] = v.value);
            return attrObj;
        }
        if (typeof (attr) === 'string') {
            return obj.getAttribute(attr);
        }
        for (let k in attr) {
            if ((k === 'class' && !attr[k].indexOf('.')) || (k === 'id' && !attr[k].indexOf('#')))
                attr[k] = attr[k].substr(1);
            attr[k] === null ? obj.removeAttribute(k) : obj.setAttribute(k, attr[k]);
        }
        return obj;
    }


    /**
     * 批量设置style
     * @param cssText
     * @private
     */
    _batchSetSheet(sheetItem, cssText) {
        this.trim(cssText, {
            char: '}',
            position: 'right'
        }).split('}').forEach(value => sheetItem.insertRule(value + '}', sheetItem.cssRules.length));
    }

    /**
     * 转驼峰写法
     * @param str
     * @returns {*}
     */
    camelize(str) {
        return (!str.includes('-') && !str.includes('_'))
            ? str
            : str.replace(
                /[-_][^-_]/g,
                match => match.charAt(1).toUpperCase()
            )
    }


    /**
     * 首字母大写
     * @param str
     * @returns {string}
     */
    capitalize(str) {
        return str.charAt(0).toUpperCase() + str.substring(1);
    }

    /**
     * TODO 不能局限于克隆数组
     * @param arr
     * @returns {*[]}
     */
    cloneArr(arr) {
        return [...arr];
    }

    /**
     * 创建dom节点
     * @param tagName
     * @param attr
     * @returns {HTMLDivElement}
     */
    createDom(tagName = 'div', attr = {}) {
        let elem = document.createElement(tagName);
        for (let key in attr) elem.setAttribute(key, attr[key]);
        return elem;
    }

    /**
     * 设置和获取样式
     * @param dom
     * @param css
     * @returns {{}}
     */
    css(dom, css = null) {
        if (css == null) {
            let cssText = dom.style.cssText;
            if (!cssText) {
                return {}
            }
            return this.styleStr2Obj(`{${cssText}}`);
        }
        for (let k in css) {
            if (css[k] === "") {
                continue
            }
            if (css[k] === null) {
                dom.style.removeProperty(this.underscored(k));
            } else {
                dom.style[k] = css[k];
            }
        }
    }


    /**
     * 定义模块
     * @param modName
     * @param fn
     * @private
     */
    _define(modName, fn) {
        this._moduleStack.set(modName, fn);
    }

    //删除css
    deleteSheet(selectorText) {
        [...document.styleSheets].forEach(v => {
            [...v.cssRules].forEach((v, i) => v.selectorText.indexOf(selectorText) === 0 && v.deleteRule(i));
        });
    }

    //批量删除
    batchDeleteSheet(selectorTextArr) {
        selectorTextArr.forEach(v => this.deleteSheet(v))
    }

    //时间日期
    /**
     * 将 Date 转化为指定格式的String * 月(M)、日(d)、12小时(h)、24小时(H)、分(m)、秒(s)、周(E)、季度(q)
     * 可以用 1-2 个占位符 * 年(y)可以用 1-4 个占位符，毫秒(S)只能用 1 个占位符(是 1-3 位的数字)
     * "yyyy-MM-dd hh:mm:ss.S" ==> 1995-09-19 08:09:04.423
     * "yyyy-MM-dd E HH:mm:ss" ==> 1995-09-19 二 20:09:04
     * "yyyy-MM-dd EE hh:mm:ss" ==> 1995-09-19 周二 08:09:04
     * "yyyy-MM-dd EEE hh:mm:ss" ==> 1995-09-19 星期二 08:09:04
     * "yyyy-M-d h:m:s.S" ==> 1995-9-19 8:9:4.18
     */
    date(fmt = 'yyyy-MM-dd HH:mm:ss', date = new Date()) {
        let o = {
            "M+": date.getMonth() + 1, //月份
            "d+": date.getDate(), //日
            "h+": date.getHours() % 12 === 0 ? 12 : date.getHours() % 12, //小时
            "H+": date.getHours(), //小时
            "m+": date.getMinutes(), //分
            "s+": date.getSeconds(), //秒
            "q+": Math.floor((date.getMonth() + 3) / 3), //季度
            "S": date.getMilliseconds() //毫秒
        };
        let week = {
            "0": "/u65e5",
            "1": "/u4e00",
            "2": "/u4e8c",
            "3": "/u4e09",
            "4": "/u56db",
            "5": "/u4e94",
            "6": "/u516d"
        };
        if (/(y+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (date.getFullYear() + "").substr(4 - RegExp.$1.length));
        }
        if (/(E+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "/u661f/u671f" : "/u5468") : "") + week[date.getDay() + ""]);
        }
        for (let k in o) {
            if (new RegExp("(" + k + ")").test(fmt)) {
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length === 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
            }
        }
        return fmt;
    }

    // 差集
    difference(arr1, arr2) {
        let diffArr = null;
        if (!arr1.length && !arr2.length) {
            diffArr = [];
        } else if (arr1.length && arr2.length) {
            arr2 = new Set(arr2);
            diffArr = [...new Set(arr1.filter(x => !arr2.has(x)))];
        } else {
            diffArr = arr1.length ? arr1 : arr2;
        }
        return diffArr;
    }

    /**
     * 数组去重
     * @param arr
     * @returns {*[]}
     */
    distinct(arr) {
        return [...new Set(arr)]
    }


    /**
     * 下载日志
     * @param logApi 下载日志的后台服务 没有此项参数，默认下载本次会话的日志
     */
    downLog(logApi = '') {

    }

    /**
     * 清空指定元素
     * @param dom 目标对象
     * @param rep 不写默认清空，是节点或者是字符串则填充
     * @param text 是否以字符模式填充
     */
    empty(dom, rep = null, text = false) {
        dom.innerHTML = '';
        if (rep) {
            if (typeof rep === 'object')//对象
                dom.appendChild(rep);
            else if (typeof rep === 'string') {
                if (text)//字符
                    this.text(dom, rep);
                else//html
                    this.html(dom, rep)
            }
        }
    }

    /**
     * html转实体
     * @param str
     * @returns {string}
     */
    escapeHTML(str) {
        return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /**
     * 格式化css
     */
    formatStyle() {
        this.setStrSheet(`
            *{
                box-sizing: border-box;
                -webkit-text-size-adjust: none;
            }
            blockquote, body, button, dd, dl, dt, fieldset, form, h1, h2, h3, h4, h5, h6, hr, input, legend, li, ol, p, pre, td, textarea, th, ul {
                margin: 0;
                padding: 0
            }
            html,body{
                cursor:auto;
                width:100%;
                height:100%;
                overflow: hidden;
                padding: 0;
            }
            body, button, input, select, textarea, a, li {
                font-size: 12px;
                line-height:1.2;
                font-family:-apple-system,"Helvetica Neue",Helvetica,Arial,"PingFang SC","Hiragino Sans GB","WenQuanYi Micro Hei","Microsoft Yahei",sans-serif;
                -webkit-font-smoothing: antialiased;
                word-wrap: break-word;
            }
            
            input,textarea,select,button{
                outline:none
            }
            
            h1, h2, h3, h4, h5, h6, button, input, select, textarea {
                font-size: 100%
            }
            
            input[type=button] {
                cursor: pointer
            }
            
            address, cite, dfn, em, var {
                font-style: normal
            }
            
            code, kbd, pre, samp {
                font-family: courier new, courier, monospace
            }
            
            small {
                font-size: 12px
            }
            
            ol, ul {
                list-style: none;
            }
            
            a {
                text-decoration: none;
                color: #555
            }
            
            sup {
                vertical-align: text-top
            }
            
            sub {
                vertical-align: text-bottom
            }
            
            img {
                border: 0
            }
            
            label,button{
                cursor:pointer;
            }
            
            iframe{
                display:block;
                border:none;
            }
           
            table {
                border-collapse: collapse;
                border-spacing: 0
            }
            
            .hide {
                display:none !important;
            }
            
            .ellipsis {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            .centerWrap {
                display: flex;
                justify-content: center;
                align-items: center;
            }
            
            .alt{
                position: relative;
                cursor: pointer;
            }
            .alt:after{
                font-size: 10px;
                position: absolute;
                bottom: -12px;
                left: 0;
                background: #cecece;
                width: 50px;
                height: 15px;
                text-align: center;
                line-height: 15px;
                z-index: 2;
                display: none;
                border-radius: 3px;
            }
            
            .alt:hover:after {
                display: block;
            }
            
            .centerBg{
                background-repeat: no-repeat;
                background-position: 50% 50%;
                background-size: contain;
            }
            
            .fillBg{
                background-repeat: no-repeat;
                background-size: 100% 100%;
            }
            
            .disable {
                filter: grayscale(100%);
                opacity: .3;
                pointer-events:none;
            }`);
    }


    setStrSheet(sheetStr) {
        if (!sheetStr) {
            return
        }
        this.trim(sheetStr, {
            char: '}',
            position: 'right'
        }).split('}').forEach((value, i) => {
            this._firstSheet.insertRule(value + '}', i)
        });
    }


    /**
     * 傻瓜屏蔽脚本
     */
    fool() {
        //删除script
        this.removeAll(document.querySelectorAll('script'));
        //无菜单
        document.oncontextmenu = () => false;
        //禁止复制粘贴剪切选中
        document.onpaste = () => false;
        document.oncopy = () => false;
        document.oncut = () => false;
        document.onselectstart = () => false;
        //屏蔽危险按键
        document.onkeydown = () => {
            let keyCode = window.event.keyCode;
            if (keyCode === 16 || keyCode === 17 || keyCode === 18 || keyCode === 123 || keyCode === 116)
                return false;
        }
    }

    /**
     * 获取样式表样式
     * @param selector
     * @returns {Set<any>}
     */
    getStyleSheet(selector = '') {
        let cssRule = new Set();
        //用 Array.from(document.styleSheets) 替换了 [...document.styleSheets]，有些浏览器在styleSheets上没有部署Iterator
        Array.from(document.styleSheets).forEach((v, i) =>
            Array.from(v.cssRules).forEach((v2, i2) => {
                if (selector !== '') {
                    if (v2.selectorText && v2.selectorText.startsWith(selector))
                        cssRule.add({
                            sheetIndex: i,
                            ruleIndex: i2,
                            rule: v2.cssText
                        })
                } else
                    cssRule.add({
                        sheetIndex: i,
                        ruleIndex: i2,
                        rule: v2.cssText
                    })
            })
        );
        return cssRule;
    }

    /**
     * 是否包含class
     * @param dom
     * @param clazz
     * @returns {*}
     */
    hasClass(dom, clazz) {
        //TODO
        //return [...dom.classList].some(v => v === clazz)
        return dom.classList.contains(clazz);
    }


    /***
     * 添加文本
     * @param dom
     * @param str
     * @param position
     * @returns {*}
     */
    html(dom, str = null, position = null) {
        /*
        beforebegin：在 element 元素的前面。
        afterbegin：在 element 元素的第一个子节点前面。
        beforeend：在 element 元素的最后一个子节点后面。
        afterend：在 element 元素的后面。
        */
        if (!str && !position) {
            this.empty(dom);
            return dom
        }

        if (!str) {
            //当追加空的的时候，不能清空
            return dom
        }
        if (position) {
            dom.insertAdjacentHTML(position, str);
        } else {
            dom.innerHTML = str
        }
        return dom
    }

    /**
     *
     * @param dom
     * @param str
     * @param plus
     * @returns {Text|string}
     */
    text(dom, str = null, plus = false) {
        if (str !== null) {
            let textNode = this.textNode(str);
            if (!plus) {
                dom.innerText = ''
            }
            this.append(dom, textNode);
            return dom
        } else {
            return dom.innerText;
        }
    }

    /**
     * iconFont
     * @param ttfUrl
     * @param fontSize
     */
    iconFont({
                 ttfUrl = this.path() + 'iconfont/iconfont.ttf',
                 fontSize = 16
             } = {}) {

        this._batchSetSheet(this._firstSheet,
            `@font-face {
                font-family: "iconfont";
                src:url('${ttfUrl}') format('truetype')
            }
            .iconfont {
                font-family: "iconfont" !important;
                font-size: ${fontSize}px;
                font-style: normal;
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale
            }`
        );
    }

    /**
     * TODO 要兼容存在空格和换行的情况
     * 查询是否存在样式
     * 这采用倒序，倒序查询在大量样式的情况下会节约时间
     * @param selectorText
     * @returns {*|boolean}
     */
    hasSheet(selectorText) {
        return selectorText && [...document.styleSheets].reverse().some(v => [...v.cssRules].reverse().some(v2 => v2.selectorText && v2.selectorText === selectorText));
    }

    formatSelectorText() {
        //去掉换行

        //去掉空格
    }

    animationSheet(keyframes, {
        duration = .5,
        timing = 'ease',
        iteration = 1,
        fill = 'forwards',
        delay = 0
    } = {}) {
        let name = keyframes + duration + timing + iteration + fill + delay;
        name = name.replace(/\./g, "d");
        if (!this.getStyleSheet('.' + name).size) //执行不存在
            this.setSheet('.' + name, {
                animationName: keyframes,
                animationDuration: duration + 's',
                animationTimingFunction: timing,
                animationIterationCount: iteration,
                animationFillMode: fill,
                animationDelay: delay + 's'
            });
        return name;
    }

    hide(dom) {
        dom.length !== undefined || typeof dom === "NodeList"
            ? dom.forEach(v => this.addClass(v, 'hide'))
            : this.addClass(dom, 'hide');

    }

    show(dom) {
        dom.length !== undefined
            ? dom.forEach(v => this.removeClass(v, 'hide'))
            : this.removeClass(dom, 'hide');
    }

    // 交集
    intersect(arr1, arr2) {
        new [...Set([...arr1].filter(x => arr2.has(x)))];
    }

    /**
     * 打开连接
     * @param url
     * @param data
     * @param open
     */
    link(url, data = {}, open = false) {
        let param = '';
        if (data) {
            for (let k in data) {
                param += k + '=' + escape(data[k]) + '&';
            }
        }
        //param = param + this.randomChar() + "=" + new Date().getTime();
        if (param !== "") {
            param = param.substring(0, param.length - 1);
            if (url.includes("?")) {
                url += "&" + param;
            } else {
                url += "?" + param;
            }
        }
        //url = encodeURI(url);
        open ? window.open(url, "_blank") : window.location.href = url;
    }

    linkReplace(url, data = {}) {
        let param = '';
        if (data) {
            for (let k in data) {
                param += k + '=' + escape(data[k]) + '&';
            }
        }
        //param = param + this.randomChar() + "=" + new Date().getTime();
        if (param !== "") {
            param = param.substring(0, param.length - 1);
            if (url.includes("?")) {
                url += "&" + param;
            } else {
                url += "?" + param;
            }
        }
        document.location.replace(url);
    }


    /**
     * 打开新的窗口
     * @param url
     * @param data
     */
    open(url, data = {}) {
        this.link(url, data, true);
    }


    loadImg(src, cb) {
        let img = new Image();
        img.src = src;
        img.onload = () => cb(img);
        img.onerror = e => this.log(e, 'error');
    }

    /**
     * 异步加载js
     * @param path
     * @param callback
     */
    loadScriptAsync(path, callback) {
        if (this._scriptSet.has(path)) callback();
        else {
            let oScript = this.createDom("script");
            oScript.setAttribute('src', path);
            this.append(this._head, oScript);
            this.remove(oScript);
            oScript.onload = () => {
                this._scriptSet.add(path);
                typeof callback === "function" && callback();
            }
        }
    }

    /**
     * 同步加载文件
     * @param path
     */
    loadFileSync(path) {
        let xhr = new XMLHttpRequest(),
            res = null;
        xhr.onload = () => res = JSON.parse(xhr.responseText);
        xhr.open("GET", path, false);
        xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xhr.send(null);
        return res;
    }


    /**
     * 同步加载js，js会等待执行直至加载完成，执行的逻辑，可写在会掉函数中或者独立下一行
     * @param path
     * @param cb
     */
    loadScriptSync(path, cb) {
        if (!this._scriptSet.has(path)) {
            let xhr = new XMLHttpRequest();
            xhr.onload = () => {
                if (xhr.responseText) {
                    let oScript = this.createDom("script", {
                        language: "javascript",
                        type: "text/javascript"
                    });
                    oScript.text = xhr.responseText;

                    this.append(this._head, oScript);
                    this._scriptSet.add(path);
                    this.remove(oScript);
                    cb && cb();
                } else {
                    this.log('加载js失败！', 'error');
                    return null;
                }
            };
            xhr.open('GET', path, false);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.send(null);
        } else {
            cb && cb()
        }
    }

    /**
     * 加载文本js
     * @param key
     * @param str
     * @param cb
     */
    loadScriptStr(key, str, cb) {
        if (!this._scriptSet.has(key)) {
            if (str) {
                let oScript = this.createDom("script", {
                    language: "javascript",
                    type: "text/javascript"
                });
                oScript.text = str;
                this.append(this._head, oScript);
                this._scriptSet.add(key);
                this.remove(oScript);
                cb && cb();
            } else {
                this.log('加载js失败！', 'error');
                return null;
            }
        } else {
            cb && cb()
        }
    }

    /**
     * 同步加载json
     * @param path
     * @param cb
     */
    loadJSONAsync(path, cb = null) {
        let data = null;
        if (!this._JSONMap.has(path)) {
            let xhr = new XMLHttpRequest();
            xhr.onload = () => {
                if (xhr.responseText) {
                    try {
                        data = JSON.parse(xhr.responseText);
                    } catch (e) {
                        console.log(e);
                        this.log('加载json失败！', 'error');
                        return null;
                    }
                    this._JSONMap.set(path, data);
                    typeof cb === "function" && cb();
                } else {
                    this.log('加载json失败！', 'error');
                    return null;
                }
            };
            xhr.open('GET', path, false);
            xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
            xhr.send(null);
        } else {
            typeof cb === "function" && cb();
            return this._JSONMap.get(path);
        }
        return data;
    }


    /**
     * 输出日志
     * @param str 日志内容
     * @param type 日志类型
     * @param logApi 接收前端日志的后台服务
     */
    log(str, type = 'log', logApi = '') {
        let name = this.date() + ' EasyScript';
        switch (type) {
            case 'log':
                console.log('[' + name + ' LOG] ', str);
                break;
            case 'warn':
                console.warn('[' + name + ' WARN] ', str);
                break;
            case 'error':
                console.error('[' + name + ' ERROR]', str);
                break;
        }
    }

    /**
     * 监视器，用于收集用户信息，鼠标点击，悬停，轨迹，ip，浏览器信息，系统信息，设备信息，浏览时长等
     * @param api 接收前端监控的后台服务
     * @param immediately 默认false 页面卸载时发送给服务端，time 即时发送给服务端的毫秒时间间隔（慎重考虑服务端性能）
     */
    monitor(api, immediately = false) {

    }

    /**
     * 绑定数据，引用消失会自动被垃圾回收清除
     * @param key 必须是obj
     * @param value
     */
    /*onData(key, value) {
        if (typeof key === "object") this._weakDate.set(key, value);
    }

    getData(key) {
        return this._weakDate.get(key);
    }*/

    //最大公约数
    gcd(a, b) {
        if (!b) {
            return a;
        }
        return this.gcd(b, a % b);
    }

    //最小公倍数
    scm(a, b) {
        return (a * b) / this.gcd(a, b);
    }

    /**
     * 解除事件
     * @param selecter
     * @param evt
     */
    off(selecter, evt) {
        !evt
            ? this._eventMap.delete(selecter)
            : this._eventMap.get(selecter).delete(evt)
    }

    /**
     * 绑定事件
     * @param selecter
     * @param params
     */
    on(selecter, ...params) {
        let target = document.body;
        let evt = 'click';
        let callback = params.pop();
        //两个参数：selecter,evt,callback
        if (params.length === 1) evt = params[0];
        //三个参数：selecter,target,evt,callback
        if (params.length === 2) {
            target = params[0];
            evt = params[1];
        }

        //自定义事件
        evt === 'drag' && this.on(selecter, target, 'mousedown', null);
        evt === 'resize' && this.on(selecter, target, 'mouseover', null);
        evt === 'rightClick' && this.on(selecter, target, 'mousedown', null);

        //增加父元素列表
        if (!this._domEvent.has(target)) this._domEvent.set(target, new Map());

        if (!this._eventMap.get(target)) this._eventMap.set(target, new Set());

        if (!this._eventMap.get(target).has(evt)) {
            //增加事件
            this._eventMap.get(target).add(evt);
            //绑定原始事件，修正blur,focus等事件，冒泡到绑定的父元素
            target.addEventListener(evt, e => {
                this._excEvent(e, target);
            }, (evt === 'blur' || evt === 'focus' || evt === "scroll"));
        }

        //增加事件元素
        if (!this._domEvent.get(target).has(selecter)) this._domEvent.get(target).set(selecter, new Map());
        //增加事件列表
        if (!this._domEvent.get(target).get(selecter).get(evt)) this._domEvent.get(target).get(selecter).set(evt, new Set());
        //保存事件
        this._domEvent.get(target).get(selecter).get(evt).add(callback);
    }


    _excEvent(e, target) {
        //查找所有元素是否有事件
        let path = e.path || (e.composedPath && e.composedPath());
        //排除body,html,document,window
        let domLen = path.length - 4 - 1;
        //冒泡
        for (; domLen + 1; --domLen)
            this._onFunction(path[domLen], target, e);
    }


    /**
     *
     * @param node
     * @param target
     * @param e
     * @private
     */
    _onFunction(node, target, e) {
        let event = e.type;
        let realTarget = e.target;

        let keyArr = [node.nodeName];
        if (node.id) keyArr.push('#' + node.id);

        node.classList.forEach(v => keyArr.push('.' + v));

        //根据绑定事件的元素查找事件
        let eventTarget = this._domEvent.get(target);
        //冒泡找绑定事件的元素的子元素，看有没有事件
        keyArr.forEach(key => {
            //找到元素上的事件
            if (eventTarget.get(key) && eventTarget.get(key).has(event)) {
                //特殊事件的处理，比如拖拽和改变大小是由 mousedown mousemove mouseover 组合成的
                if (event === 'mousedown') {
                    //拖拽
                    eventTarget.get(key).has('drag') && eventTarget.get(key).get('drag').forEach(v => this._drag(node, realTarget, v));
                    //右键
                    eventTarget.get(key).has('rightClick') && eventTarget.get(key).get('rightClick').forEach(v => this._rightClick(node, realTarget, v, e));
                    //中键
                    eventTarget.get(key).has('centerClick') && eventTarget.get(key).get('centerClick').forEach(v => this._centerClick(node, realTarget, v, e));
                    //TODO 双击
                    //TODO 长按
                }
                if (event === 'mouseover') {
                    eventTarget.get(key).has('resize') && eventTarget.get(key).get('resize').forEach(v => this._resize(node, realTarget, v));
                }
                eventTarget.get(key).get(event).forEach(v => typeof v === 'function' && v(node, realTarget, e))
            }
        });
    }

    //右键
    _rightClick(target, realTarget, cb, ev) {
        if (ev.buttons === 2) {
            cb(target, realTarget);
        }
    }

    //中键
    _centerClick(target, realTarget, cb, ev) {
        if (ev.buttons === 3) {
            cb(target, realTarget);
        }
    }

    //拖拽
    _drag(target, realTarget, cb) {
        //父元素有缩放，转化偏移量
        let offset = 1;
        let zoom = target.parentNode.style.zoom;
        let transform = target.parentNode.style.transform;
        if (zoom) {
            offset = 1 / parseFloat(zoom)
        } else if (transform) {
            let substr = transform.match(/scale\((\S*)\)/);
            if (substr[1]) {
                offset = 1 / parseFloat(substr[1])
            }
        }

        let x0 = window.event.screenX * offset,
            y0 = window.event.screenY * offset,
            tTop = parseInt(target.style.top),
            tLeft = parseInt(target.style.left);
        //修改大小时候不拖动
        if (target.style.cursor && target.style.cursor !== 'default') return;
        //执行
        let top, left;
        window.onmousemove = e => {
            top = tTop - y0 + e.screenY * offset;
            left = tLeft - x0 + e.screenX * offset;
            target.style.top = top + 'px';
            target.style.left = left + 'px';
        };
        //卸载
        window.onmouseup = () => {
            this._disposeWindowOn();
            cb && cb(target, realTarget, top, left);
        }
    }

    _disposeWindowOn() {
        window.onmousemove = null;
        window.onmousedown = null;
        window.onmouseup = null;
    };

    //调整大小
    _resize(target, realTarget, cb) {
        //父元素有缩放，转化偏移量
        let offset = 1;

        let scaleMatch = target.parentNode.style.transform.match(/scale\((.*?)\)/);
        let translateMatch = target.parentNode.style.transform.match(/translate\((.*?)\)/);

        //zoom
        let scale = scaleMatch ? scaleMatch[1] : 1;
        let translateX = 0, translateY = 0;

        if (scale) {
            offset = 1 / parseFloat(scale);
            let translate = translateMatch ? translateMatch[1] : "0,0";
            let arr = translate.split(",");
            translateX = parseFloat(arr[0]);
            translateY = parseFloat(arr[1]);
        }

        let isChangeSize = false;
        let padding = 10;
        let tTop, tLeft, tWidth, tHeight,
            diffX, diffY;
        let cursor = 'default';

        let getPositionSize = () => {
            let size = this.domSize(target),
                position = this.domPosition(target);
            tWidth = size.width;
            tHeight = size.height;
            tTop = position.top;
            tLeft = position.left;
        };


        //执行，只改变手势
        target.onmousemove = e => {
            if (isChangeSize) return;
            getPositionSize();

            let ly = e.layerY + (1 - scale) * tTop - translateY * scale,
                lx = e.layerX + (1 - scale) * tLeft - translateX * scale,
                p = padding * offset;

            let top = ly < p,
                bottom = ly > tHeight * scale - p,
                left = lx < p,
                right = lx > tWidth * scale - p;

            if (left && !top && !bottom) cursor = 'w-resize';//左
            else if (right && !top && !bottom) cursor = 'e-resize';//右
            else if (top && !left && !right) cursor = 'n-resize';//上
            else if (bottom && !left && !right) cursor = 's-resize';//下
            else if (left && top) cursor = 'nw-resize';//左上
            else if (left && bottom) cursor = 'sw-resize';//左下
            else if (right && top) cursor = 'ne-resize';//右上
            else if (right && bottom) cursor = 'se-resize';//右下
            else cursor = 'default';//无动作

            target.style.cursor = cursor;
        };
        target.onmousedown = () => {
            getPositionSize();
            let x0 = window.event.screenX * offset,
                y0 = window.event.screenY * offset;

            //绑定移动事件
            window.onmousemove = moveEvent => {
                isChangeSize = true;
                //位移差
                diffX = moveEvent.screenX * offset - x0;
                diffY = moveEvent.screenY * offset - y0;

                let
                    top = () => {
                        target.style.height = (tHeight - diffY) + 'px';
                        target.style.top = (tTop + diffY) + 'px';
                    },
                    bottom = () => target.style.height = (tHeight + diffY) + 'px',
                    left = () => {
                        target.style.width = (tWidth - diffX) + 'px';
                        target.style.left = (tLeft + diffX) + 'px';
                    },
                    right = () => target.style.width = (tWidth + diffX) + 'px';

                //改变大小
                if (cursor === 'e-resize') right(); //右边拉动
                else if (cursor === 's-resize') bottom();//下边拉动
                else if (cursor === 'w-resize') left(); //左边拉动
                else if (cursor === 'n-resize') top();//上边拉动
                else if (cursor === 'nw-resize') {//左上
                    left();
                    top();
                } else if (cursor === 'ne-resize') {//右上
                    right();
                    top();
                } else if (cursor === 'sw-resize') {//左下
                    left();
                    bottom();
                } else if (cursor === 'se-resize') {//右下
                    right();
                    bottom();
                }
            };

            //鼠标抬起事件
            window.onmouseup = () => {
                isChangeSize = false;
                //更新位置
                getPositionSize();
                //解除事件
                this._disposeWindowOn();
                cb && cb(target, realTarget);
            }
        };
    }

    /**
     * 自适应大小
     * @param wrap
     * @param content
     * @param padding
     * @returns {{t: number, w: number, h: number, scale: number, l: number}}
     */
    autoSize(wrap, content, padding = 0) {
        padding = padding * 2;
        let ww = wrap.w - padding,
            wh = wrap.h - padding;

        let relW, relH;
        let ratioW = ww / content.w;
        let tempH = content.h * ratioW;
        if (tempH <= wh) {
            relW = content.w * ratioW;
            relH = tempH;
        } else {
            let ratioH = wh / content.h;
            relW = content.w * ratioH;
            relH = content.h * ratioH;
        }
        return {
            w: relW, h: relH,
            t: (wh - relH + padding) / 2, l: (ww - relW + padding) / 2,
            scale: relW / content.w
        }
    }

    /**
     * 向数组的尾部拼接数组
     * @param tagArr 目标数组
     * @param endArr 尾部数组
     * @returns {*|number}
     */
    pushEnd(tagArr, endArr) {
        if (!Array.isArray(endArr))
            return tagArr;
        return tagArr.push(...endArr);
    }


    query(select, target = document) {
        return target.querySelector(select);
    }

    queryAll(select, target = document) {
        return target.querySelectorAll(select);
    }

    /**
     * 随机字母
     * @param len
     * @param type
     * @returns {string}
     */
    randomChar(len = 4, type = 'upper') {
        let rc = '';
        for (let i = 0; i < len; ++i)
            rc += String.fromCharCode(65 + Math.ceil(Math.random() * 25));
        return type === 'upper' ? rc : rc.toLowerCase();
    }


    /**
     * 随机数
     * @param minNum
     * @param maxNum
     * @returns {number}
     */
    randomNum(minNum = 0, maxNum = 1000) {
        return parseInt(Math.random() * (maxNum - minNum + 1) + minNum, 10);
    }

    /**
     * read方法
     * @param callback
     * @param rename
     * @param wait
     */
    ready(callback, rename = false, wait = true) {
        wait ? this._isReady
            ? this.log('page has already been built', 'warn')
            : document.addEventListener('DOMContentLoaded', () => {
                this._isReady = true;
                this.body = document.body;
                rename ? callback(this) : callback();
            })
            : rename ? callback(this) : callback();
    }

    /**
     * 删除节点
     * @param dom
     * @param parent
     */
    remove(dom, parent = null) {
        dom && (typeof dom === "string" && parent
            ? this.remove(this.queryAll(dom, parent))
            : dom.length !== undefined
                ? dom.forEach(v => v.parentNode.removeChild(v))
                : dom.parentNode.removeChild(dom))
    }

    /**
     * TODO 根据正则删除元素类名
     * 删除多个元素的多个类名
     * @param dom
     * @param clazz
     */
    removeClass(dom, clazz) {
        dom.length !== undefined
            ? dom.forEach(vd => Array.isArray(clazz)
            //? clazz.forEach(vc => vd.classList.remove(vc))
            ? clazz.forEach(vc => this._removeClass(vd, vc))
            //: vd.classList.remove(clazz))
            : this._removeClass(vd, clazz))
            : Array.isArray(clazz)
            //? clazz.forEach(vc => dom.classList.remove(vc))
            ? clazz.forEach(vc => this._removeClass(dom, vc))
            //: dom.classList.remove(clazz);
            : this._removeClass(dom, clazz);
        return dom;
    }

    _removeClass(dom, clazz) {
        Object.prototype.toString.call(clazz) === '[object RegExp]'
            ? dom.classList.forEach(v => clazz.test(v) && dom.classList.remove(v))
            : dom.classList.remove(clazz);
    }

    /**
     * 替换
     * @param str 原字符串
     * @param findRep{'目标字符':'替换后字符'}
     * @returns {*}
     */
    replaceAll(str, findRep) {
        for (let f in findRep) str = str.replace(new RegExp(f, 'g'), findRep[f])
        return str;
    }


    /**
     * 加载模块
     * @param path
     * @param option
     * @param callback
     * @param className
     * @private
     */
    _require(path, option = {}, callback = () => {
    }, className = path.split('/').pop()) {
        //option.className = className;
        option.call ? option.call.push(className) : option.call = [className];
        this.loadScript(path + '.class.js', () => callback(this._moduleStack.get(className)(option)))
    }

    /**
     * 同步加载模块
     * @param path
     * @param option
     * @param className
     * @returns {*}
     * @private
     */
    _requireAsync(path, option = {}, className = path.split('/').pop()) {
        this.loadScriptAsync(path + '.class.js');
        //option.className = className;
        option.call ? option.call.push(className) : option.call = [className];
        return this._moduleStack.get(className)(option);
    }


    /**
     * 将完整的html页面的文本形式当做页面打开，并且无法查看源码，没法使用查看元素没法另存为无法刷新没有网址
     * @param html
     */
    runCode(html) {
        let winname = window.open('', "_blank", '');
        winname.document.open('text/html', 'replace');
        winname.opener = null;
        winname.document.write(html);
        winname.document.close();
    }

    /**
     * 设置css
     * @param selector
     * @param rules
     *
     * sheet.insertRule("body { background-color: silver }", 0);  //DOM方法
     * sheet.addRule("body", "background-color: silver", 0);  //仅对IE有效
     *
     */
    setSheet(selector, rules) {
        let rulesText = selector + '{';
        for (let k in rules)
            rulesText += this.underscored(k) + ':' + rules[k] + ';';
        this._lastSheet.insertRule(rulesText + '}', this._lastSheet.cssRules.length);
        return selector;
    }

    /**
     * 简单的名字
     * @param len 边界数量为 26^len
     * @returns {*}
     */
    simple(len = 4) {
        let simpleSelecterName = this.randomChar(len);
        if (document.querySelector('.' + simpleSelecterName) || document.querySelector('#' + simpleSelecterName))
            this.simple();
        else if (!this.getStyleSheet('.' + simpleSelecterName).size || !this.getStyleSheet('#' + simpleSelecterName).size)
            return simpleSelecterName;
        else
            this.simple();
    }


    /**
     * 获取文本的长度，兼容各种码点的长度
     * @param str
     * @returns {number}
     */
    strLength(str) {
        let size = 0;
        for (let i of str) ++size;
        return size;
    }

    /**
     * css字符串转对象
     * @param styleStr
     * @param type
     * @returns {{}}
     */
    styleStr2Obj(styleStr, type = 'camelize') {
        let ruleObj = {};
        if (!styleStr) {
            return ruleObj;
        }
        let styleStrArr = styleStr.match(/{([\s\S]*)}/);
        if (!styleStrArr || styleStrArr.length < 2) {
            return ruleObj;
        }
        let item = [];
        this.trim(this.trim(styleStrArr[1]), {
            char: ';',
            position: 'right'
        }).split(';').forEach(v => {
            item = v.split(':');
            let k = this.trim(item[0]);
            if (type === 'camelize') k = this.camelize(k);
            ruleObj[k] = this.trim(item[1]);
        });
        return ruleObj;
    }

    /**
     * 移除html标记
     * @param str
     * @returns {string}
     */
    stripTages(str) {
        return str.replace(/<script[^>]*>([\S\s]*?)<\/script>/img, '').replace(/<[^>]+>/g, '');
    }

    /**
     * 文本节点，或将html标记输出为文本
     * @param str
     * @returns {Text}
     */
    textNode(str = '') {
        return document.createTextNode(str);
    }

    /**
     * 替换类名/切换类名
     * @param dom 操作的元素
     * @param newClass 新的类名
     * @param oldClass 旧的类名
     * @returns doms
     */
    toggleClass(dom, newClass, oldClass) {
        if (oldClass) { //已经存在的类名，替换为新的类名
            if (this.hasClass(dom, oldClass)) {
                this.removeClass(dom, oldClass);
            } else {
                this.log("不存在的类名！", "warn");
            }
            this.addClass(dom, newClass);
        } else { // 切换类名
            this.hasClass(dom, newClass) ? this.removeClass(dom, newClass) : this.addClass(dom, newClass);
        }
        return dom;
    }


    /**
     *  去除空白和指定字符串，无参默认去除左右空白
     * @param str
     * @param char 指定字符 默认：''
     * @param position  left right 默认：''
     * @returns {string}
     */
    trim(str, {
        char = '',
        position = ''
    } = {}) {
        if (!str) {
            return str
        }
        let newStr = '';
        if (char) {
            if (position === 'left')
                newStr = str.replace(new RegExp('^\\' + char + '+', 'g'), '');
            if (position === 'right')
                newStr = str.replace(new RegExp('\\' + char + '+$', 'g'), '');
            if (position === '')
                newStr = str.replace(new RegExp('^\\' + char + '+|\\' + char + '+$', 'g'), '');
        } else {
            newStr = str.trim();
        }

        return newStr;
    }

    /**
     * 字符的截断处理
     * @param str
     * @param length
     * @param truncation
     * @returns {string}
     */
    truncate(str, length = 30, truncation = '...') {
        return str.length > length
            ? str.slice(0, length - truncation.length) + truncation
            : str
    }

    /**
     * TODO 修改css
     * @param selector
     * @param rules
     */
    updateSheet(selector, rules) {
        let style = this.getStyleSheet(selector);
        if (style) {
            console.log(this.styleStr2Obj(style.rule));
        }
    }

    /**
     * 转划线写法
     * @param str
     * @returns {string}
     */
    underscored(str, type = '-') {
        return str.replace(/([a-z\d])([A-Z])/g, '$1' + type + '$2').replace(/\-/g, type).toLowerCase();
    }

    /**
     * 实体转html
     * @param str
     * @returns {string}
     */
    unescapeHTML(str) {
        return str.replace(/&quot;/g, '"')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, "&") //处理转义的中文和实体字符
            .replace(
                /&#([\d]+);/g,
                ($0, $1) => String.fromCharCode(parseInt($1, 10))
            );
    }

    /**
     * 并集
     * @param arr1
     * @param arr2
     * @returns {*[]}
     */
    union(arr1, arr2) {
        return [...new Set([...arr1, ...arr2])]
    }


    /**
     * 当前库路径
     * @returns {string}
     */
    path() {
        let arr = document.currentScript.src.split('/');
        let root = '/';
        for (let i = 3; i < arr.length - 1; ++i)
            root += arr[i] + '/';
        return root;
    }

    /**
     * 寻找指定的父节点
     * TODO 目前只支持class，后期完善id和标签
     * @param dom
     * @param upper
     * @returns {(() => (Node | null)) | ActiveX.IXMLDOMNode | (Node & ParentNode) | module:echarts/data/Tree~TreeNode}
     */
    parent(dom, upper = null) {

        if (typeof upper === null) {
            return dom.parentNode;
        }
        upper = this.trim(upper, {
            char: '.',
            position: 'left'
        });

        let tempParent = dom.parentNode;
        //递归寻找指定的上级
        while (upper && !this.hasClass(tempParent, upper) && tempParent.nodeType !== 9) {
            tempParent = tempParent.parentNode;
        }
        return tempParent;
    }

    verify(type, value) {
        let res = false;
        let reg = null;
    }

    domSize(dom) {
        return {
            width: dom.offsetWidth,
            height: dom.offsetHeight
        }
    }

    domPosition(dom) {
        return {
            top: dom.offsetTop,
            left: dom.offsetLeft
        }
    }

    /**
     * 获取窗口大小
     * @returns {{ww: number, wh: number}}
     */
    windowSize() {
        return {
            ww: document.body.offsetWidth,
            wh: document.body.offsetHeight
        }
    }

    innerSize() {
        return {
            iw: window.innerWidth,
            ih: window.innerHeight
        }
    }


    wrap(target, wrap) {
        let index = 0;
        [...target.parentNode.childNodes].some(v => {
            if (v.nodeName !== '#text') {
                ++index;
                return v === target
            }
        });
        this.append(target.parentNode, wrap, index);
        this.append(wrap, target);
    }

    /**
     * 获取地址栏参数
     */
    getQueryVar() {
        let query = window.location.search.substring(1);
        let vars = query.split("&");
        let obj = {};
        vars.forEach(v => {
            if (v) {
                let pair = v.split("=");
                obj[pair[0]] = unescape(pair[1]);
            }
        });
        return obj;
    }

    domIndex(dom) {
        let parent = dom.parentNode;
        let index = 0;
        [...parent.childNodes].some((v, i) => {
            if (v === dom) {
                index = i;
                return true;
            }
        });
        return index;
    }


    /******** ming yang *****/
    /**
     *  typeOf 数据类型判断
     * @param  {*} param 任何类型的变量
     * @returns {string} {result} 变量的数据类型
     */

    typeOf(param) {
        const typeStr = Object.prototype.toString.call(param);
        //[object String]
        let result = typeStr.slice(8, -1).toLowerCase(); // 转化为小写

        const reg = /element/g;
        if (reg.test(result)) { //dom元素
            result = "element";
        }

        return result;
    }

    /**
     * each 每个元素的操作
     * @param {*} arrayLike 类数组元素
     * @callback  {each-eachCallback} cb 每个元素的回调
     * @returns arr 返回原输入
     */

    each(arrayLike, cb) {
        const type = this.typeOf(arrayLike);
        let arr = arrayLike,
            len = 0;
        switch (type) {
            case "string":
                arr = [].slice.call(arr);
                arr.forEach((item, i) => {
                    cb && cb(item, i, arr);
                });
                break;
            case "object":
                for (let i in arr) {
                    cb && cb({[i]: arr[i]}, len, arr);
                    len++;
                }
                break;
            case "array":
            case "map":// 没有索引值
            case "set":// 没有索引值
                arr.forEach((item, i) => {
                    cb && cb(item, i, arr);
                });
                break;
            case "nodelist":
                arr.forEach((item, i) => {
                    cb && cb(item, i, arr);
                });
                break;
            default:
                arr = [arr];
                cb && cb(item, i, arr);
        }
        return arr;
    }

    /**
     * 判断dom元素的类型
     * @param {string} [str=""] 字符串
     * @returns {string} result dom类型
     *
     * */
    typeOfElement(str = "") {
        if (this.typeOf(str) !== "string") {
            this.log('请输入正确的字符串！', "error");
            return null;
        }
        //css 命名合法范围
        // http://www.w3.org/TR/CSS21/syndata.html#value-def-identifier
        const identifier = "(?:\\\\.|[\\w-]|[^\0-\\xa0])+";
        const matchExpr = {
            "ID": new RegExp("^#(" + identifier + ")"),
            "CLASS": new RegExp("^\\.(" + identifier + ")"),
            "TAG": new RegExp("^(" + identifier + "|[*])")
        };
        let result = null;
        this.each(matchExpr, (item, i) => {
            for (let k in item) {
                if (item[k].test(str)) {
                    result = k;
                }
            }
        });
        return result;
    }


    /***
     * 寻找当前元素的相邻元素 支持CLASS类名，ID和TAG标签
     * 类似 siblings(jquery)
     * @ param {object} ele(nodeList)类型 当前的dom元素
     * @ clazz {string} [clazz] ".id"|".class"|"tag"
     */
    siblings(ele, clazz) {
        const type = this.typeOfElement(clazz);
        if (this.typeOf(ele) === "element") {

            let nextSiblingDom = ele.parentNode.firstChild,
                matched = [];

            for (; nextSiblingDom; nextSiblingDom = nextSiblingDom.nextSibling) {
                if (nextSiblingDom.nodeType === 1 && nextSiblingDom !== ele) {
                    matched.push(nextSiblingDom);
                }
            }

            let newMatched = [],
                role = {
                    "CLASS": "className",
                    "ID": "id"
                };
            switch (type) {
                case "CLASS":
                case "ID":
                    this.each(matched, (ele, i) => {
                        for (let j in role) {
                            if ((".") + ele[role[j]] === clazz || ("#") + ele[role[j]] === clazz) {
                                newMatched.push(ele);
                            }
                        }
                    });
                    break;
                case "TAG":
                    this.each(matched, (ele, i) => {
                        if (ele.nodeName.toLowerCase() === clazz) {
                            newMatched.push(ele);
                        }
                    });
                    break;
                default:
                    newMatched = matched;
                    break;
            }

            return newMatched;

        } else {
            this.log("请输入正确的dom元素！", "log");
            return null;
        }

    }


    /***
     * 寻找当前元素的子类元素 支持CLASS类名，ID和TAG标签
     * 类似 find(jquery)
     * @ param {object} ele(nodeList)类型 当前的dom元素
     * @ clazz {string} [clazz] ".id"|".class"|"tag"
     */
    find(ele, clazz) {

        if (this.typeOf(ele) === "element") {
            if (!clazz) {
                return ele;
            }
            return this.queryAll(clazz, ele.parentNode);
        } else {
            this.log("请输入正确的dom元素！", "log");
            return null;
        }
    }

    secToTime(s) {
        let t = '';
        if (s > -1) {
            let hour = Math.floor(s / 3600);
            let min = Math.floor(s / 60) % 60;
            let sec = s % 60;
            t += (hour + ':').padStart(3, '0');
            t += (min + ':').padStart(3, '0');
            t += (sec + '').padStart(2, '0');
        }
        return t;
    }

    timeToSec(time) {
        let s = 0;
        time.split(':').forEach((v, i) =>
            s += parseInt(v.value) * Math.pow(60, 2 - i));
        return s;
    }

    checkConn(timer, cb) {
        let url = window.location.href;
        let xhr;
        setInterval(() => {
            xhr = new XMLHttpRequest();
            xhr.onload = () => xhr.responseText && cb(true);
            try {
                xhr.open("GET", url, false);
                xhr.send(null);
            } catch (e) {
                cb(false)
            }
        }, timer);
    }

    addActive(dom) {
        if (dom) {
            dom.length !== undefined
                ? dom.forEach(v => this.addActive(v))
                : this.addClass(dom, 'active');
        }
    }

    hasActive(dom) {
        return this.hasClass(dom, "active")
    }

    removeActive(dom) {
        if (dom) {
            dom.length !== undefined
                ? dom.forEach(v => this.removeActive(v))
                : this.removeClass(dom, 'active');
        }
    }

    toggleActive(dom) {
        //去掉已激活元素
        this.removeActive(this.queryAll(".active", dom.parentNode));
        //激活自己
        this.addActive(dom);
    }

    toggleActiveSelf(dom, add, remove) {
        if (this.hasClass(dom, "active")) {
            typeof add === "function" && remove(dom);
            this.removeActive(dom);
        } else {
            typeof add === "function" && add(dom);
            this.addActive(dom);
        }
    }

    getData(dom, suffix = "id") {
        return this.attr(dom, "data-" + suffix);
    }

    setData(dom, data, suffix = "id") {
        let attr = {};
        attr["data-" + suffix] = data;
        this.attr(dom, attr)
    }

    emptyData(dom, suffix) {
        this.setData(dom, "", suffix);
    }

    //TODO https://blog.csdn.net/wconvey/article/details/54171693

    /**
     * 设置临时的数据
     * @param data
     * @param key
     */
    setLocTempData(data, key = "tmp") {
        localStorage.setItem(key, data);
    }

    /**
     * 取出临时的数据，取出后将会删除
     * @param data
     * @param key
     */
    getLocTempData(key = "tmp") {
        let data = localStorage.getItem(key);
        localStorage.removeItem(key);
        return data
    }

    randomColor() {
        return 'rgb(' + [
            Math.round(Math.random() * 160),
            Math.round(Math.random() * 160),
            Math.round(Math.random() * 160)
        ].join(',') + ')';
    }

    position(dom) {
        return {
            top: dom.offsetTop,
            left: dom.offsetLeft
        }
    }

    fileSave(name, url) {
        let a = document.createElement('a');
        // 创建一个单击事件
        let event = new MouseEvent('click');
        a.download = name;
        a.href = url;
        a.dispatchEvent(event);
    }

    attempt(condition, func, interval = 1000) {
        condition() ? func() : setTimeout(
            () => this.attempt(condition, func, interval),
            interval)
    }

    prevDom(dom) {
        if (!dom) {
            return null;
        }
        let prevDom = dom.previousSibling;
        if (!prevDom) {
            return null;
        }
        if (prevDom.nodeType !== Node.ELEMENT_NODE) {
            prevDom = this.prevDom(prevDom);
        }
        return prevDom;
    }

    nextDom(dom) {
        if (!dom) {
            return null;
        }
        let nextDom = dom.nextSibling;
        if (!nextDom) {
            return null;
        }
        if (nextDom.nodeType !== Node.ELEMENT_NODE) {
            nextDom = this.nextDom(nextDom);
        }
        return nextDom;
    }

    appendTo(parent, child, index) {
        if (!index || index >= parent.children.length) {
            parent.appendChild(child);
            return;
        }
        if (index < 1) {
            parent.insertBefore(child, parent.children[0]);
            return;
        }
        parent.insertBefore(child, parent.children[index])
    }

    //向后移动本节点
    moveNext(dom) {
        let nextDom = cp.nextDom(dom);
        nextDom && dom.parentNode.insertBefore(nextDom, dom);
    }

    //向前移动本节点
    movePrev(dom) {
        let prevDom = cp.prevDom(dom);
        prevDom && dom.parentNode.insertBefore(dom, prevDom);
    }

    //傻瓜屏蔽脚本
    endebug(errorPage = "/error") {
        !function (e) {
            function n(e) {
                function n() {
                    return u
                }

                function o() {
                    window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized ? t("on") : (a = "off", console.log(d), console.clear(), t(a))
                }

                function t(e) {
                    u !== e && (u = e, "function" == typeof c.onchange && c.onchange(e))
                }

                function r() {
                    l || (l = !0, window.removeEventListener("resize", o), clearInterval(f))
                }

                "function" == typeof e && (e = {
                    onchange: e
                });
                var i = (e = e || {}).delay || 500,
                    c = {};
                c.onchange = e.onchange;
                var a, d = new Image;
                d.__defineGetter__("id", function () {
                    a = "on"
                });
                var u = "unknown";
                c.getStatus = n;
                var f = setInterval(o, i);
                window.addEventListener("resize", o);
                var l;
                return c.free = r, c
            }

            var o = o || {};
            o.create = n;
            window.jdetects = o
        }(), jdetects.create(function (e) {
            var a = 0;
            var n = setInterval(function () {
                if ("on" == e) {
                    setTimeout(function () {
                        if (a == 0) {
                            a = 1;
                            localStorage.clear();
                            sessionStorage.clear();
                            setTimeout(function () {
                                document.write("");
                                top.location.href = errorPage + "?t=" + new Date().getTime()
                            });
                        }
                    }, 200)
                }
            }, 100)
        })
    }


    clipboard(str, cb = null) {
        const inputDom = this.createDom("INPUT", {
            value: str
        });
        document.body.appendChild(inputDom);
        inputDom.select();
        let flag = document.execCommand('copy');
        if (flag && typeof cb === "function") {
            cb();
        }
        document.body.removeChild(inputDom);
    }

    children(dom) {
        dom.childNodes.forEach(v => {
            if (v.nodeType === 3) {
                dom.removeChild(v);
            }
        })
        return dom.childNodes;
    }
}

!window.cp ? window.cp = new Cp() : console.warn('cp 全局变量已被占用！');