import { ReactNode } from "react";

export function ChartCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        padding: "16px",
        background: "#fff",
      }}
    >
      <h3 style={{ margin: "0 0 12px", fontSize: "16px" }}>{title}</h3>
      {children}
    </section>
  );
}

