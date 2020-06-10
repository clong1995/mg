class App {
    DOM() {
        //这里统一做dom的选择，
        //请不要在js里的其他地方到处乱写dom的选择器，即难看又难读！

        this.btn1Dom = document.querySelector(".btn1");
        this.btn2Dom = document.querySelector(".btn2");
        this.btn3Dom = document.querySelector(".btn3");
        this.btn4Dom = document.querySelector(".btn4");
        this.boxDom = document.querySelector(".box");
    }

    INIT() {
        //这里是整个文件最先执行的一个方法
        //写在这里的代码，会优先执行

        console.log("hello world!")
    }

    EVENT() {
        //这里做事件的统一绑定
        //请不要在js里的其他地方到处乱写事件，即难看又难读！

        this.btn1Dom.addEventListener("click", this.button1);
        this.btn2Dom.addEventListener("click", this.button2.bind(this));
        this.btn3Dom.onclick = this.button3;
        this.btn4Dom.addEventListener("click", () => {
            alert("button4");
        });
    }

    READY() {
        //所有模块加载完后会会执行，后面详细介绍
    }

    //========= 下面是自定义的一些方法，用于演示

    button1() {
        alert("button1");
    }

    button2() {
        this.boxDom.style.background = "green";
    }

    button3() {
        alert("button3");
    }
}