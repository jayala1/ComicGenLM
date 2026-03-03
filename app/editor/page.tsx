"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CanvasEditor from "../../components/CanvasEditor";
import { ComicProject } from "../../lib/schema";
import { loadProject, saveProject } from "../../lib/storage";

export default function EditorPage() {
  const [project, setProject] = useState<ComicProject | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const loaded = await loadProject();
      if (mounted) {
        setProject(loaded);
      }
    }

    void init();

    return () => {
      mounted = false;
    };
  }, []);

  const onProjectChange = (next: ComicProject) => {
    setProject(next);
    void saveProject(next);
  };

  if (!project) {
    return (
      <main className="page-shell stack">
        <div className="card stack">
          <h1 style={{ margin: 0 }}>Page editor</h1>
          <p style={{ margin: 0 }}>No local project found. Create your project on the main page first.</p>
          <Link href="/" className="button secondary" style={{ width: "fit-content" }}>
            Back to project
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell stack">
      <div className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Page editor</h1>
        <Link href="/" className="button secondary">
          Back to project
        </Link>
      </div>

      <CanvasEditor project={project} onProjectChange={onProjectChange} />
    </main>
  );
}
