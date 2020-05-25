const CONF = {
    //页面地址
    WebAddr: "http://127.0.0.1:50003",
    //服务地址
    //ServerAddr: "https://127.0.0.1",
    ServerAddr: "http://127.0.0.1:8080",
};

//判断有没有token，没有的话


if (typeof global === "undefined") {
    //浏览器回到首页
    switch (window.location.pathname) {
        case "/":
        case "/signup":
        case "/api":
        case "/signupPhoneCode":
        case "/loginPhoneCode":
            break;
        default:
            window.location.href = "/";
    }
} else {
    //客户端回到登录
    if (!localStorage.getItem("token") && window.location.pathname !== "/login") {
        localStorage.clear();
        window.location.href = "/login"
    }
}


//ajax的额外处理器
//根目录
const ajaxRequestRoot = CONF.ServerAddr;

//消息头处理
const ajaxHeadersInterceptor = url => {
    let arr = url.split("/");
    let l = arr.pop(),
        p = arr.pop();

    //不需要token的接口
    switch (`${p}/${l}`) {
        case "business/signupPhoneCode":
        case "business/loginPhoneCode":
        case "business/signup":
        case "nvc/analyze":
        case "business/login":
            return {
                "Content-type": "application/x-www-form-urlencoded"
            }
    }

    //验证token
    let token = localStorage.getItem("token");
    if (!token) {
        cp.link("/login");
        return;
    }
    return {
        "Content-type": "application/x-www-form-urlencoded",
        "token": token
    }
};
//消息体处理
const ajaxResponseInterceptor = res => {
    /*if (res.code !== 0) {
        console.error(res);
        if (res.code === 2) { //认证错误
            localStorage.removeItem("Authorization");
            cp.link("/login");
            //终止程序
            return false;
        }
    }*/
    if(res.state === "token is invalid"){
        localStorage.clear();
        cp.link("/login");
        return false;
    }
    return res;
};

