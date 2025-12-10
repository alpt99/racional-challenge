import Link from "next/link";

export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f5f5f5",
        padding: "24px",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: "28px" }}>
          Racional App Challenge
        </h1>
        <Link
          href="/firestoreGraph"
          style={{ color: "#2563eb", fontWeight: 600, textDecoration: "none" }}
        >
          Firestore Graph
        </Link>
      </div>
    </main>
  );
}
