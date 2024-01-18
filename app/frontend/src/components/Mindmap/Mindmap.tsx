

import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";
import { useLayoutEffect, useRef, useState } from "react";
import styles from "./Mindmap.module.css";
import { Stack } from "@fluentui/react";
import { useTranslation } from 'react-i18next';
import { Button, Tooltip } from "@fluentui/react-components";
import { ArrowDownload24Regular, ContentView24Regular, ScaleFill24Regular } from "@fluentui/react-icons";
interface Props {
    markdown: string;
}


export const Mindmap = ({ markdown }: Props) => {
    const { t } = useTranslation();
    const transformer = new Transformer();
    const svgEl = useRef<SVGSVGElement>(null);
    const [isSourceView, setIsSourceView] = useState(false);

    useLayoutEffect(() => {
        createMM();
    }, []);


    const toggleSourceView = () => {
        setIsSourceView(!isSourceView);
        setTimeout(() => {
            if (isSourceView) {
                createMM();
            }
        }, 50)
    }

    const rescale = () => {
        setTimeout(() => {
            if (!isSourceView) {
                let mm = Markmap.create(svgEl.current as SVGSVGElement);
                mm.destroy();
                createMM();
            }
        }, 50)
    }

    const download = () => {
        if (svgEl && svgEl.current) {
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

    const createMM = () => {
        let mm = Markmap.create(svgEl.current as SVGSVGElement);
        if (mm) {
            const { root } = transformer.transform(markdown || "");
            mm.setData(root);
            mm.fit();
        }
    }

    return (
        <Stack verticalAlign="space-between" className={`${styles.mindmapContainer}`}>
            <Stack.Item>
                <Stack horizontal horizontalAlign="end">
                    <div>
                        <Tooltip content={isSourceView ? t('components.mindmap.source') : t('components.mindmap.mindmap')} relationship="description" positioning="above">
                            <Button appearance="subtle" aria-label={isSourceView ? t('components.mindmap.source') : t('components.mindmap.mindmap')} icon={<ContentView24Regular className={styles.iconRightMargin} />}
                                onClick={() => toggleSourceView()} size="large">
                            </Button>
                        </Tooltip>
                        {!isSourceView &&
                            <Tooltip content={t('components.mindmap.reset')} relationship="description" positioning="above">
                                <Button appearance="subtle" aria-label={t('components.mindmap.reset')} icon={<ScaleFill24Regular className={styles.iconRightMargin} />}
                                    onClick={() => rescale()} size="large">
                                </Button>
                            </Tooltip>
                        }
                        {!isSourceView &&
                            <Tooltip content={t('components.mindmap.download')} relationship="description" positioning="above">
                                <Button appearance="subtle" aria-label={t('components.mindmap.download')} icon={<ArrowDownload24Regular className={styles.iconRightMargin} />}
                                    onClick={() => download()} size="large">
                                </Button>
                            </Tooltip>
                        }
                    </div>
                </Stack>
            </Stack.Item>
            {!isSourceView ?
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


