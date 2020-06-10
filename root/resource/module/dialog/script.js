class Module {
    DOM() {
        this.titleDom = cp.query('.title', DOMAIN);
        this.confirmDom = cp.query('.confirm', DOMAIN);
        this.cancelDom = cp.query('.cancel', DOMAIN);
        this.textDom = cp.query('.text', DOMAIN);
        this.contentDom = cp.query('.content', DOMAIN);
        this.signDom = cp.query('.sign', this.contentDom);
        this.iconDom = cp.query('.icon', this.signDom);
    }

    EVENT() {
        //coo.on('.confirm', this.optionDom, 'click', t => this.cofirmFn && this.cofirmFn(t));
    }

    INIT() {
        this._sheetStyle();
    }

    //内置样式
    _sheetStyle() {
        cp.setSheet('#' + NAME, {
            width: '100%',
            height: '100%',
            background: 'rgba(255,255,255,.5)',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 999
        });
        cp.addClass(DOMAIN, ['centerWrap', 'hide'])
    }

    /**
     *
     * @param type
     * @param icon
     * @param title
     * @param text
     * @param confirm
     * @param confirmText
     * @param cancel
     * @param cancelText
     */
    show({
             type = 'info',
             icon = '',
             title = '',
             text = '提示信息',
             confirm = null,
             confirmText = "确定",
             cancel = null,
             cancelText = "取消",
         } = {}) {
        //提示信息
        if (type === 'info') {
            icon = '&#xe665;';
            title = '提示';
        }
        //警告信息
        else if (type === 'warn') {
            icon = '&#xe63f;';
            title = '警告';
        }
        //错误信息
        else if (type === 'error') {
            icon = '&#xe63a;';
            title = '错误';
        }
        //等待信息
        else if (type === 'loading') {
            icon = '&#xe6ab;';
            title = '等待';
        }
        //自定义
        else if (type === 'custom') {

        }
        //title
        cp.text(this.titleDom, title);

        //icon
        if (icon) {//存在icon
            cp.removeClass(this.contentDom, "centerWrap");
            cp.html(this.iconDom, icon);
            cp.show(this.signDom);
        } else {
            cp.addClass(this.contentDom, "centerWrap");
            cp.hide(this.signDom);
        }

        //text
        this.text(text);
        cp.text(this.confirmDom,confirmText);

        //一直存在确认按钮
        this.confirmDom.onclick = () => confirm && typeof confirm === 'function'
            ? confirm(this.hide.bind(this))
            : this.hide();


        //取消，只有在警告级别才会有
        if ((type === 'warn' || type === 'custom') && cancel && typeof cancel === 'function') {
            cp.show(this.cancelDom);
            cp.text(this.cancelDom,cancelText);
            this.cancelDom.onclick = () => cancel(this.hide.bind(this));
        }

        //显示窗口
        cp.show(DOMAIN);
    }

    text(text) {
        cp.html(this.textDom, text);
    }

    hide() {
        cp.hide(DOMAIN);
        this.dispose();
        return this
    }

    dispose() {
        this.confirmDom.onclick = null;
        this.cancelDom.onclick = null
    }
}