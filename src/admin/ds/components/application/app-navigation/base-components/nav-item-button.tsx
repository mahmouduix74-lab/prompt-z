import type { FC, MouseEventHandler } from "react";
import { Link as AriaLink } from "react-aria-components";
import { Tooltip } from "../../../base/tooltip/tooltip";
import { cx } from "../../../../utils/cx";

const styles = {
    md: { root: "size-10", icon: "size-5" },
    lg: { root: "size-12", icon: "size-6" },
};

interface NavItemButtonProps {
    /** Whether the item is the current page. */
    current?: boolean;
    /** The size of the button. */
    size?: "md" | "lg";
    /** The page the button opens. */
    href?: string;
    /** The label, shown in the tooltip and read by screen readers. */
    label: string;
    /** The icon of the item. */
    icon: FC<{ className?: string }>;
    /** Where the tooltip opens. */
    tooltipPlacement?: "top" | "right" | "bottom" | "left";
    /** A small dot on the icon, for something that needs attention. */
    dot?: boolean;
    onClick?: MouseEventHandler;
    className?: string;
}

/** The icon-only nav item of the slim sidebar: an icon with its label in a tooltip. */
export const NavItemButton = ({ current, size = "md", href, label, icon: Icon, tooltipPlacement = "right", dot, onClick, className }: NavItemButtonProps) => {
    return (
        <Tooltip title={label} placement={tooltipPlacement}>
                <AriaLink
                    href={href}
                    aria-label={label}
                    aria-current={current ? "page" : undefined}
                    onClick={onClick}
                    className={cx(
                        "relative flex cursor-pointer items-center justify-center rounded-md bg-primary p-2 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2",
                        current && "bg-secondary text-fg-quaternary_hover hover:bg-secondary_hover",
                        styles[size].root,
                        className,
                    )}
                >
                    <Icon aria-hidden="true" className={cx("shrink-0 transition-inherit-all", styles[size].icon)} />
                    {dot && <span className="absolute top-2 end-2 size-2 rounded-full bg-fg-error-primary ring-2 ring-bg-primary" />}
                </AriaLink>
        </Tooltip>
    );
};
