# BioCloud: a browser-native platform for collaborative molecular structure visualization and annotation

**Authors:** [Author list to be finalized]

**Associate Editor:** [To be assigned]

---

## Abstract

**Motivation:** Three-dimensional visualization of biological macromolecules is a vital tool in advancing structural biology and biochemistry education. 

Current web-based viewers, including Mol* and NGL Viewer, must be server-based or use complicated local installations, limiting access to students and early-stage researchers with limited institutional budgets. 

In addition, there is no lightweight platform that provides integrated views for comparing multiple files and collaboratively annotating residues at a fine-grained level, all within a single, installation-free interface. 

**Results:** This paper presents BioCloud, an open-source web platform, which performs all molecular rendering client-side using WebGL via the 3Dmol.js library, thus completely removing any server-side compute dependencies. BioCloud allows uploading of multiple structure files per project and sequential navigation between them, as well as the implementation of an annotation system at the atom level, allowing for textual comments anchored in spatial positions on selected atoms by the user. Row Level Security policies provide fine-grained project access control, allowing private and public projects. The loading time renders results in less than two seconds for large structures of up to 58870 atoms on a generic commodity laptop. No installation is necessary, and the software runs on any modern web browser. 

**Availability and Implementation:** BioCloud is implemented in Next.js 14 with a Supabase (PostgreSQL) backend. Source code is available at https://github.com/messiay/biocloud under an open-source license. A public deployment is accessible at https://biocloud-ten.vercel.app.

---

## 1 Introduction

Structural visualization remains a cornerstone of macromolecular research, drug discovery, and biochemistry pedagogy [1, 2]. Widely adopted tools fall into two categories: desktop applications such as PyMOL [3] and UCSF Chimera [4], which require local installation and often licensed seats; and web-based viewers such as Mol* [5], NGL Viewer [6], and 3Dmol.js [7], which vary in their server-side requirements and collaborative capabilities.

A persistent challenge in academic settings is the *computational accessibility gap*. Server-rendered approaches demand GPU-provisioned backend infrastructure, the cost of which scales linearly with concurrent users—a model incompatible with classroom-scale deployments in resource-limited institutions. Desktop tools, conversely, impose installation overhead and platform-specific dependencies that create friction in heterogeneous computing environments.

Equally underserved is the need for *contextual collaboration* on structural data. While general-purpose platforms enable file sharing, no lightweight tool currently permits users to attach annotations directly to individual atoms within a three-dimensional structural context and share those annotations with collaborators in real time.

BioCloud addresses both gaps. By delegating all rendering computation to the client browser's WebGL pipeline, the platform eliminates server-side GPU requirements. Its architecture further introduces two features absent from existing lightweight viewers: (i) multi-file project support with a carousel-based navigation interface, enabling comparative structural analysis; and (ii) an atom-level annotation system that spatially anchors textual commentary to specific atomic coordinates.

## 2 Implementation

### 2.1 System Architecture

BioCloud is implemented as a full-stack web application using the Next.js 14 framework [8] with the App Router paradigm. The backend is provided by Supabase [9], an open-source Backend-as-a-Service platform wrapping PostgreSQL 15, which supplies authentication, object storage, real-time subscriptions, and a RESTful API (PostgREST) without requiring custom server code. The system architecture is illustrated in **Figure 1A**.

The rendering stack employs a strict Client-Side Rendering (CSR) model. Molecular structure files are fetched directly from Supabase Object Storage to the browser, where 3Dmol.js [7]—loaded via dynamic `import()` to avoid server-side evaluation—performs all parsing, geometry generation, and WebGL rendering within the client's GPU context. This design has a critical operational consequence: the hosting server (Vercel, in the reference deployment) serves only static JavaScript bundles and proxies database queries. It performs zero rendering computation, enabling the platform to serve an arbitrary number of concurrent visualization sessions at fixed infrastructure cost.

### 2.2 Data Model

The relational schema comprises five principal tables (**Figure 1B**):

- **`projects`**: Stores project metadata including title, primary file URL, file format extension, optional CSV data attachment, privacy flag (`is_public`), and owner-authored notes.
- **`project_files`**: Implements multi-file support. Each row references a parent `project_id` (foreign key, `ON DELETE CASCADE`) and stores a distinct file URL, extension, display name, and an integer `sort_order` for carousel sequencing.
- **`annotations`**: Stores atom-level annotations. Each record captures the atom serial number, atom name, residue name, residue sequence identifier, chain identifier, Cartesian coordinates (*x*, *y*, *z*), free-text content, and references to both `project_id` and optionally `file_id`.
- **`comments`**: General per-project discussion threads, linked to authenticated user profiles.
- **`profiles`**: User metadata synchronized from the authentication provider.

All tables enforce Row Level Security (RLS) policies at the database level. For `project_files` and `annotations`, SELECT policies permit read access when the parent project's `is_public` flag is `true` or when the requesting user matches the `owner_id`. INSERT policies restrict writes to authenticated users with appropriate ownership or public-project access. DELETE policies on annotations permit removal by either the annotation author or the project owner, implementing a dual-authority moderation model.

### 2.3 Multi-File Carousel Viewer

Projects in BioCloud may contain multiple structure files (e.g., apo and holo conformations, homologous structures, or ligand-bound variants). Files are uploaded simultaneously through a multi-file input interface and stored as individual rows in `project_files` with sequential `sort_order` values. The `FileCarousel` component renders a horizontally scrollable strip of file selectors above the 3D viewport (**Figure 2A**). Selecting a file triggers re-initialization of the 3Dmol.js viewer with the corresponding file URL and format. The first uploaded file is additionally stored in the legacy `projects.file_url` column, ensuring backward compatibility with any external integrations referencing the canonical project URL.

Owners may upload additional files or remove existing ones from the carousel without affecting other project metadata. Deletion cascades to associated annotations via the `ON DELETE CASCADE` constraint on `project_files.id`.

### 2.4 Atom-Level Annotation System

The annotation system enables spatially-anchored commentary on individual atoms. Users interact with the 3Dmol.js viewer in an annotation mode where atoms become clickable targets via the `viewer.setClickable()` API. Upon atom selection, the `AtomAnnotationPopup` component renders a positioned overlay displaying the atom's identity (element symbol, atom name, residue name, residue sequence number, chain identifier) and a text input for the annotation body (**Figure 2B**).

Upon submission, the annotation record is persisted to the `annotations` table with full atomic metadata, including Cartesian coordinates. These coordinates enable spatial re-rendering: when a project is loaded, all existing annotations for the active file are rendered as translucent spheres and text labels at the corresponding 3D positions using `viewer.addSphere()` and `viewer.addLabel()` (**Figure 2C**). This visual overlay persists across viewer rotations and zoom operations, maintaining spatial context.

Annotations are displayed textually in a dedicated "Annotations" tab within the `InteractionPanel`, grouped and tagged by residue identity, enabling users to review all positional commentary without requiring 3D navigation.

### 2.5 Security Model

BioCloud implements a zero-trust data access model through PostgreSQL RLS, evaluated at the database engine level before any row is returned to the API. Authentication is handled by Supabase Auth (supporting email/password and OAuth providers), which issues JSON Web Tokens consumed by PostgREST for policy evaluation. Storage bucket policies further restrict file uploads to user-specific directory prefixes (`{user_id}/`), preventing cross-user write access to object storage. Projects default to public visibility but may be toggled to private by the owner via an in-line `PrivacyToggle` control.

## 3 Usage and Results

BioCloud is deployed at https://biocloud-ten.vercel.app. A typical workflow proceeds as follows: (i) the user authenticates and creates a new project by uploading one or more structure files (PDB, SDF, MOL2, XYZ, CIF, PQR, or CUBE format) with an optional CSV data attachment; (ii) the 3D viewer renders the first file, with the carousel providing access to additional structures; (iii) collaborators access the project via its public URL, add annotations to atoms of interest, and participate in threaded discussion; (iv) the project owner manages annotations, comments, and file attachments from a unified interface.

### 3.1 Performance Benchmarks

The client-side rendering model was evaluated empirically on a commodity laptop (AMD Ryzen, 12 logical cores, 8 GB RAM, AMD Radeon 740M integrated GPU, Windows 10, Chrome 145). Three PDB structures of increasing size were loaded through the same 3Dmol.js pipeline used by BioCloud. Rendering performance was measured using the `performance.now()` API; interactive frame rates were measured over 5-second continuous rotation intervals using `requestAnimationFrame` (**Table 1**).

All structures rendered in under 2 seconds on commodity hardware, with interactive frame rates exceeding 21 FPS across all tested sizes. These results confirm the feasibility of the zero-server-compute approach for typical pedagogical and research use cases. Re-render times (warm cache) ranged from 3.1 to 22.5 ms, indicating that interactive operations (rotation, zoom) do not introduce perceptible latency.

## 4 Discussion

BioCloud occupies a specific niche in the molecular visualization ecosystem: it provides a zero-installation, zero-server-compute platform that combines structural viewing with spatially-anchored collaborative annotation. It is not intended to replace feature-rich desktop applications for publication-quality rendering or large-scale molecular dynamics trajectory analysis. Rather, it targets collaborative workflows in educational and small-team research contexts where infrastructure constraints preclude server-provisioned solutions.

The client-side rendering architecture introduces an inherent limitation: performance for very large structures (> 200,000 atoms) depends on the client device's GPU capabilities. Future work will investigate progressive loading strategies and level-of-detail rendering to mitigate this constraint. Additional planned features include annotation threading, structure-versus-structure alignment overlays, and integration with public repositories (PDB, UniProt) for direct structure retrieval.

## Acknowledgements

[To be completed]

## Funding

[To be completed]

*Conflict of Interest:* None declared.

---

## References

1. Burley, S.K. et al. (2019) RCSB Protein Data Bank: biological macromolecular structures enabling research and education. *Nucleic Acids Res.*, **47**, D464–D474.
2. Shi, Y. (2014) A glimpse of structural biology through X-ray crystallography. *Cell*, **159**, 995–1014.
3. Schrödinger, LLC. (2015) The PyMOL Molecular Graphics System, Version 2.0.
4. Pettersen, E.F. et al. (2004) UCSF Chimera—a visualization system for exploratory research and analysis. *J. Comput. Chem.*, **25**, 1605–1612.
5. Sehnal, D. et al. (2021) Mol* Viewer: modern web app for 3D visualization and analysis of large biomolecular structures. *Nucleic Acids Res.*, **49**, W431–W437.
6. Rose, A.S. et al. (2018) NGL Viewer: web-based molecular graphics for large complexes. *Bioinformatics*, **34**, 3755–3758.
7. Rego, N. and Koes, D. (2015) 3Dmol.js: molecular visualization with WebGL. *Bioinformatics*, **31**, 1322–1324.
8. Vercel Inc. (2024) Next.js 14 Documentation. https://nextjs.org/docs
9. Supabase Inc. (2024) Supabase Documentation. https://supabase.com/docs
10. PostgreSQL Global Development Group. (2024) PostgreSQL 15 Documentation. https://www.postgresql.org/docs/15/
11. Hanson, R.M. et al. (2013) JSmol and the Next‐Generation Web‐Based Representation of 3D Molecular Structure. *Isr. J. Chem.*, **53**, 207–216.
12. Rose, A.S. and Hildebrand, P.W. (2015) NGL Viewer: a web application for molecular visualization. *Nucleic Acids Res.*, **43**, W576–W579.
13. Goddard, T.D. et al. (2018) UCSF ChimeraX: Meeting modern challenges in visualization and analysis. *Protein Sci.*, **27**, 14–25.
14. Consortium, T.U. (2023) UniProt: the Universal Protein Knowledgebase in 2023. *Nucleic Acids Res.*, **51**, D523–D531.
15. [PLACEHOLDER — additional reference as needed]

---

## Figure 1 — System Architecture & Data Model

### Panel A: System Architecture

![Figure 1A — BioCloud system architecture showing client-side rendering via 3Dmol.js/WebGL, Vercel edge network, and Supabase backend.](figures/mermaid-drawing.png)

> **Key insight:** The Vercel server performs **zero rendering computation**. All molecular visualization is executed entirely on the user's GPU via WebGL. The server cost remains constant regardless of the number of concurrent visualization sessions.

---

### Panel B: Entity-Relationship Diagram (Database)

![Figure 1B — Entity-relationship diagram showing the five principal database tables (Users, Projects, Project_Files, Annotations) and their foreign key relationships.](figures/mermaid-drawing%20(1).png)

---

## Figure 2 — User Interface

### Panel A: Dashboard with Multi-File Upload & Project Table

![Figure 2A — BioCloud dashboard showing the multi-file upload form and project repository table with the Files count column.](figures/fig2a_dashboard.png)

*The dashboard displays the multi-file upload interface (top) with separate drop zones for biological structures (multiple files allowed) and CSV data. The project table (bottom) includes a **Files** column showing per-project file counts alongside view counts, upload dates, and privacy status.*

---

### Panel B: Atom Annotation Popup

![Figure 2B — The AtomAnnotationPopup showing atom identity (LYS-1220, Chain A), spatial coordinates, and the text input for adding contextual annotations.](figures/fig2b_annotation_popup.png)

*Clicking any atom in the 3D viewer triggers the AtomAnnotationPopup, which displays the atom's identity (residue, chain, serial number, Cartesian coordinates) and lists any existing annotations. Authenticated users can add new spatially-anchored comments via the text input.*

---

### Panel C: Annotation Markers Rendered on the 3D Structure

![Figure 2C — Annotation markers rendered on the 3D structure showing "ASP1150 binding site" as a purple label with translucent indigo sphere at the annotated atom position.](figures/fig2c_annotation_markers.png)

*Saved annotations are rendered as translucent indigo spheres with text labels displaying the full comment content (here, "ASP1150 binding site") directly on the 3D structure. Labels persist across rotations and zoom operations, providing persistent spatial context for collaborative review.*

---

## Table 1 — Client-Side Rendering Performance

**Test Hardware:** AMD Ryzen (12 cores) / AMD Radeon 740M integrated GPU / 8 GB RAM / Windows 10 / Chrome 145

**Rendering mode:** cartoon + stick (same as BioCloud default for proteins). Measurements via `performance.now()` and `requestAnimationFrame` over 5-second rotation intervals.

| PDB ID | Structure                 | Atom Count | File Size (KB) | Render Time (ms) | Re-render / Warm (ms) | Interactive FPS |
|--------|---------------------------|------------|----------------|-------------------|-----------------------|-----------------|
| 4HHB   | Hemoglobin tetramer       | 4,779      | 463            | **460**           | 3.1                   | **21.9**        |
| 1JFF   | Glutamate dehydrogenase   | 6,702      | 587            | **803**           | 5.0                   | **22.7**        |
| 1AON   | GroEL chaperonin          | 58,870     | 4,857          | **1,964**         | 22.5                  | **21.3**        |

**Notes:**
- Render time measures client-side computation only (model parsing + geometry generation + first WebGL draw call), excluding network fetch time.
- Interactive FPS measured during continuous Y-axis rotation via `requestAnimationFrame`.
- All tests performed on integrated graphics — discrete GPU hardware is expected to yield higher frame rates.

---

## Items Remaining for Authors

- [ ] Finalize author list, funding, and acknowledgements
- [ ] Fill or remove Reference #15 placeholder
- [ ] Consider adding benchmarks from additional device categories (desktop GPU, tablet) — open `benchmark.html` on each device
- [ ] Capture annotation popup and annotation marker screenshots (Figure 2B/2C as described in text Sections 2.3/2.4) by creating a test project with active annotations
