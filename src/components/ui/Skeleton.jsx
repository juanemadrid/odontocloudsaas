import React from "react";
import "./skeleton.css"; // We'll create this CSS next

export default function Skeleton({
    width,
    height,
    variant = "text", // text, circular, rectangular
    className = "",
    style = {}
}) {
    const styles = {
        width: width,
        height: height,
        ...style
    };

    return (
        <div
            className={`odc-skeleton ${variant} ${className}`}
            style={styles}
        />
    );
}
