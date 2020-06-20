/*
 <div class="container">
     <div class="board">
     <div class="panel" style="background-image: url(https://h5-web-app.oss-cn-beijing.aliyuncs.com/community/temp/1.jpg)"></div>
     <div class="panel" style="background-image: url(https://h5-web-app.oss-cn-beijing.aliyuncs.com/community/temp/2.jpeg)"></div>
     <div class="panel" style="background-image: url(https://h5-web-app.oss-cn-beijing.aliyuncs.com/community/temp/3.jpg)"></div>
     </div>
     <div class="dots"></div>
 </div>
 */
class Module {
    DOM() {

    }

    INIT() {

    }

    EVENT() {

    }

    run(container) {
        let name = cp.simple();
        cp.addClass(container, name);
        let size = cp.domSize(container);
        this.formatStyle(name, size.width);
        let boardDom = cp.query(".board", container);
        boardDom.style.left = `-${size.width}px`;
        let panelListDom = cp.queryAll(".panel", boardDom);
        let len = panelListDom.length;
        let dotsDom = cp.query(".dots", container);
        if (dotsDom) {
            for (let i = 0; i < len; i++) {
                cp.append(dotsDom, cp.createDom("DIV", {
                    class: "dot",
                }));
            }
        }
        let dotListDom = cp.queryAll(".dot", dotsDom);
        dotsDom && cp.toggleActive(dotListDom.item(0));
        let index = 1;

        for (let i = 0; i < panelListDom.length; i++) {
            if (!i) {
                cp.append(boardDom, panelListDom[i].cloneNode(true))
            }

            if (i === panelListDom.length - 1) {
                cp.append(boardDom, panelListDom[panelListDom.length - 1].cloneNode(true), 0)
            }
        }
        panelListDom = cp.queryAll(".panel", boardDom);

        let prev = () => {
            index--;
            this.animate(boardDom, size.width);
            if (index === 0) {
                setTimeout(() => {
                    let width = -len * size.width
                    cp.css(boardDom, {
                        transition: "0s",
                        left: parseInt(boardDom.style.left) + width + "px"
                    })
                }, 500)
                index = len;
            }
            dotsDom && cp.toggleActive(dotListDom.item(index - 1))
        }
        let next = () => {
            index++
            this.animate(boardDom, -1 * size.width);
            if (index === panelListDom.length - 1) {
                setTimeout(() => {
                    let width = len * size.width
                    cp.css(boardDom, {
                        transition: "0s",
                        left: parseInt(boardDom.style.left) + width + "px"
                    })
                }, 500)
                index = 1;
            }
            dotsDom && cp.toggleActive(dotListDom.item(index - 1))
        }

        //左右点击
        let prevDom = cp.query(".prev", container);
        let nextDom = cp.query(".next", container);
        if (prevDom && nextDom) {
            cp.html(prevDom, "﹤");
            cp.html(nextDom, "﹥");
            prevDom.onclick = this.throttle(prev);
            nextDom.onclick = this.throttle(next);
        }

        //左右滑动
        let stopAuto = false;
        /*let touchStart = false;
        let isWait = false
        let touchStartX = 0;
        container.ontouchstart = (event) => {
            let touch = event.changedTouches[0];
            touchStartX = touch.screenX;
            touchStart = true;
            stopAuto = true;
        }
        container.ontouchmove = (event) => {
            if (!touchStart) return;
            let touch = event.touches[0];
            let x = touch.screenX;
            let dif = x - touchStartX;
            let difAbs = Math.abs(dif);
            if (difAbs > size.width / 2) {
                if (dif < 0) {
                    next();
                } else {
                    prev();
                }
                touchStart = false;
                stopAuto = false;
                isWait = true;
            }
        }
        container.ontouchend = () => {
            touchStart = false;
            stopAuto = false;
        }*/
        container.onmouseover = () => {
            stopAuto = true;
        }
        container.onmouseout = () => {
            stopAuto = false;
        }

        setInterval(() => {
            if (!stopAuto) {
                next();
            }
        }, 3000)
    }

    formatStyle(name, width) {
        cp.setStrSheet(`
            .${name}{
                position: relative;
                overflow: hidden;
            }
            .${name} >.board{
                position: relative;
                width: 5000px;
                height: 100%;
                left: -${width}px;
            }
            .${name} >.board >.panel{
                float: left;
                width: ${width}px;
                height: 100%;
            }
            .${name} >.prev,
            .${name} >.next{
                position: absolute;
                z-index: 3;
                cursor: pointer;
                left: 0;
                height: 100%;
                top: 0;
                display: flex;
                align-items: center;
            }
            .${name} >.next{
                left: unset;
                right: 0;
            }
            .${name} >.dots{
                z-index: 2;
                display: flex;
                align-items: center;
                justify-content: center;
                position: absolute;
                left: 0;
                bottom: 0;
                padding: 10px 0;
                width: 100%;
            }
            .${name} >.dots >.dot{
                width: 10px;
                height: 10px;
                border-radius: 50%;
                background: #ccc;
                margin: 0 5px;
            }
            .${name} >.dots >.dot.active{
                background: #007aff;
            }`);
    }

    throttle(func) {
        let context, args;
        let previous = 0;

        return function () {
            let now = +new Date();
            context = this;
            args = arguments;
            if (now - previous > 500) {
                func.apply(context, args);
                previous = now;
            }
        }
    }

    animate(board, width) {
        cp.css(board, {
            transition: "0.5s",
            left: parseInt(board.style.left) + width + "px",
        })
    }
}