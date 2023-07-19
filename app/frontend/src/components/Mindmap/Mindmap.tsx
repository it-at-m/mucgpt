

import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import React, { useLayoutEffect } from "react";
import styles from "./Mindmap.module.css";
interface Props {
    markdown: string;
}

export const Mindmap = ({ markdown }: Props) => {
    const transformer = new Transformer();
    const svgEl = React.createRef<SVGSVGElement>();
    var mm: Markmap;
    useLayoutEffect(() => {
        if(mm === undefined)
            mm =  Markmap.create(svgEl.current as SVGSVGElement);
        const { root }  = transformer.transform(markdown||"")
        mm.setData(root);
        mm.fit()
      }, []);
    
    return (
      <React.Fragment  >
        <div className={styles.mindmapContainer}>
            <svg id="markmap" className="flex-1" ref={svgEl} />
        </div>
      </React.Fragment>
    );
};
