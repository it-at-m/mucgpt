

import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import React, { useLayoutEffect } from "react";

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
      <React.Fragment>
        <svg id="markmap" className="flex-1" ref={svgEl}/>
      </React.Fragment>
    );
};
