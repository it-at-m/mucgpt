

import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import React, { useLayoutEffect, useState } from "react";
import styles from "./Mindmap.module.css";
import { IconButton, Stack } from "@fluentui/react";
interface Props {
    markdown: string;
}

export const Mindmap = ({ markdown }: Props) => {
    const transformer = new Transformer();
    const svgEl = React.createRef<SVGSVGElement>();
    const [isSourceView, setIsSourceView] = useState(false);
    var mm: Markmap;
    useLayoutEffect(() => {
        if(mm === undefined)
            mm =  Markmap.create(svgEl.current as SVGSVGElement);
        const { root }  = transformer.transform(markdown||"")
        mm.setData(root);
        mm.fit()
      }, []);
    
   /*  const quelleAnzeigen = () => {
        setIsSourceView(!isSourceView);
        if(isSourceView)
        {
            const mm2 =  Markmap.create(svgEl.current as SVGSVGElement);
            const { root }  = transformer.transform(markdown||"")
            mm2.setData(root);
            mm2.fit()
        }
    } */
    
    return (
        // <Stack  verticalAlign="space-between" className={`${styles.mindmapContainer}`}>
        //     <Stack.Item>
        //         <Stack horizontal horizontalAlign="end">
        //             <div>
        //                 <IconButton
        //                     style={{ color: "black" }}
        //                     iconProps={{ iconName: "ClipboardList" }}
        //                     title="Quelle anzeigen"
        //                     ariaLabel="Quelle anzeigen"
        //                     onClick={() => quelleAnzeigen()}
        //                 />
        //             </div>
        //         </Stack>
        //     </Stack.Item>
        //     { !isSourceView ? 
        //      <Stack.Item grow>
                <React.Fragment  >
                    <div className={styles.mindmapContainer}>
                        <svg id="markmap" className={styles.svgMark} ref={svgEl} />
                    </div>
                </React.Fragment>
/*             </Stack.Item>
            :
            <Stack.Item grow>
                <div className={styles.answerText}>{markdown}</div>
            </Stack.Item>
            }
        </Stack> */
    );
};
