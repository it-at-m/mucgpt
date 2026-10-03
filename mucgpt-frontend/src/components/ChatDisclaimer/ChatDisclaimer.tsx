import { Caption1, Link } from "@fluentui/react-components";
import { Trans, useTranslation } from "react-i18next";

interface ChatDisclaimerProps {
    className?: string;
}

export const ChatDisclaimer = ({ className }: ChatDisclaimerProps) => {
    const { t } = useTranslation();

    return (
        <Caption1 block italic align="center" className={className}>
            {t("components.questioninput.errorhint")}{" "}
            <Trans
                i18nKey="components.questioninput.high_risk_hint"
                components={{ tutorial: <Link inline href="#/tutorials/high-risk" target="_blank" rel="noopener noreferrer" /> }}
            />
        </Caption1>
    );
};
