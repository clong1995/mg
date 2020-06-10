class Module {
    DOM() {

    }

    INIT() {
        this.styleName = cp.simple();
        this.setStyle();
    }

    EVENT() {

    }

    /**
     *
     * @param container
     * @param head 一维数组
     * @param body 二维数组
     */
    init(container, head, body) {
        //cp.setSheet(`#"+NAME+" > .row.row_${sh} > .column.c0`, {});

        cp.css(container, {
            overflow: "auto"
        });

        cp.addClass(container, this.styleName);

        let tableHtml = `<table>`;

        //构造head
        //let sh = cp.simple();
        tableHtml += `<thead><tr>`;
        head.forEach((v, i) => {
            tableHtml += `<th style="width: ${v.minWidth}px;">${v.title}</th>`
        });
        tableHtml += `</tr></thead>`;
        //构造body
        tableHtml += '<tbody>';
        body.forEach((v, i) => {
            tableHtml += `<tr>`;
            v.forEach((vv, ii) => {
                tableHtml += `<td>${vv}</td>`
            });
            tableHtml += `</tr>`;
        });
        tableHtml += '</tbody>';
        tableHtml += `</table>`;

        cp.html(container, tableHtml);
    }

    setStyle() {
        cp.setStrSheet(`
            .${this.styleName} > TABLE {
                width: 100%;
                height: 100%;
                font-size: 12px;
                text-align: left;
                table-layout: fixed;
            }
            
            .${this.styleName} > TABLE > THEAD > TR > TH {
                background: var(--color11);
            }
            
            .${this.styleName} > TABLE > THEAD > TR > TH,
            .${this.styleName} > TABLE > TBODY > TR > TD {
                padding-left: 10px;
            }
            
            .${this.styleName} > TABLE > TBODY > TR:nth-of-type(even){ 
                background:var(--color1);
            } 
            .${this.styleName} > TABLE > TBODY > TR:hover{
                font-weight: bolder;
            }
            
            .${this.styleName} > TABLE > THEAD > TR > TH:first-child,
            .${this.styleName} > TABLE > TBODY > TR > TD:first-child {
                position: sticky;
                left: 0;
                background: var(--color8);
            }
            
            .${this.styleName} > TABLE > THEAD > TR > TH:first-child {
                z-index: 2;
            }
            
            .${this.styleName} > TABLE > THEAD > TR > TH {
                font-weight: bolder;
                height: 25px;
                line-height: 25px;
                position: sticky;
                top: 0;
            }
            
            
            .${this.styleName} > TABLE > TBODY {
            
            }
            
            .${this.styleName} > TABLE > TBODY > TR > TD {
                padding: 5px 10px;
            }`);
    }
}