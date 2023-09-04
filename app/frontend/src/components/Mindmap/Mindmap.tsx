

import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import React, { LegacyRef, useLayoutEffect, useRef, useState } from "react";
import styles from "./Mindmap.module.css";
import { IconButton, Stack } from "@fluentui/react";
import { useTranslation } from 'react-i18next';
interface Props {
    markdown: string;
}


export const Mindmap = ({ markdown}: Props) => {
    const { t} = useTranslation ();
    const transformer = new Transformer();
    const svgEl =useRef<SVGSVGElement>(null);
    const [isSourceView, setIsSourceView] = useState(false);

    useLayoutEffect(() => {
        createMM();
      }, []);

       
     const toggleSourceView = () => {
        setIsSourceView(!isSourceView);
        setTimeout(()=> {
            if(isSourceView)
            {   
                createMM();
            }
        }, 50)
    }
    
     const rescale = () => {
        setTimeout(()=> {
            if(!isSourceView)
            {   
                let mm = Markmap.create(svgEl.current as SVGSVGElement);
                mm.destroy();
                createMM();
            }
        }, 50)
    }
    
    const download = () => {
        if(svgEl && svgEl.current){
            // fetch SVG-rendered image as a blob object
            const data = (new XMLSerializer()).serializeToString(svgEl.current);
            const svgBlob = new Blob([data], {
            type: 'image/svg+xml;charset=utf-8'
            });
        
            // convert the blob object to a dedicated URL
            const url = URL.createObjectURL(svgBlob);
        
            // load the SVG blob to a flesh image object
            const img = new Image();
            const link = document.createElement('a')
            link.href = url
            link.download = 'Idee'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
            img.src = url;
        }
    };

    const createMM = () =>  {
        let mm = Markmap.create(svgEl.current as SVGSVGElement);
        if (mm) {
            const { root } = transformer.transform(markdown || "");
            mm.setData(root);
            mm.fit();
        }
    }
    
    return (
         <Stack  verticalAlign="space-between" className={`${styles.mindmapContainer}`}>
             <Stack.Item>
                 <Stack horizontal horizontalAlign="end">
                     <div>
                        <IconButton
                             style={{ color: "black" }}
                             iconProps={{ iconName: "View" }}
                             title={isSourceView?  t('components.mindmap.source') : t('components.mindmap.mindmap') }
                             ariaLabel={isSourceView?  t('components.mindmap.source') : t('components.mindmap.mindmap') }
                             onClick={() => toggleSourceView()}
                         />
                          {!isSourceView &&
                         <IconButton
                             style={{ color: "black" }}
                             iconProps={{ iconName: "Fullscreen" }}
                             title={t('components.mindmap.reset')}
                             ariaLabel={t('components.mindmap.reset')}
                             onClick={() => rescale()}
                         />
                          }
                          {!isSourceView &&
                         <IconButton
                             style={{ color: "black" }}
                             iconProps={{ iconName: "Download" }}
                             title={t('components.mindmap.download')}
                             ariaLabel={t('components.mindmap.download')}
                             onClick={() => download()}
                         />
                          }
                     </div>
                 </Stack>
             </Stack.Item>
             { !isSourceView ? 
            <Stack.Item grow>
                <div className={styles.mindmapContainer}>
                    <svg id="markmap" className={styles.svgMark} ref={svgEl} />
                </div>
            </Stack.Item>
            :
            <Stack.Item grow>
                <div className={styles.answerText}>{markdown}</div>
            </Stack.Item>
            }
        </Stack> 
    );
};


