# MolShare: a browser-native platform for collaborative molecular structure visualization and annotation

---

## Abstract

**Motivation:** Structural and computational biologists have been forced into sharing and collecting relevant data using public tools that use raw coordinate files over email or manual workflows, which detach data files. This can lead to version error corrupted data and key communication issues when forwarding the information of target residues for docking studies over text. Furthermore, existing desktop visualizations has complex command-line and file path installations and require high-end hardware that prevents students and researchers with low-end laptops from being  able to preview or even view files without downloading them.

**Results:** Overcoming this, I propose MolShare- A browser based stand alone web application that needs no installation and no dedicated workspace for structural collaboration with their associated tabular data and allows end users to instantly share their work. MolShare supports submission of multiple 3D structures along with their associated data and allows users to share their resulting 3D environment. The atom-wise annotation functionality builds on molecular structure annotations to allow users to append their remarks directly onto the 3D structure of the target residues. This eliminates the complex discussion completely. All rendering of the 3D states are done on the client side Device, letting the user interact, analyse and explore the molecular state with very low hardware requirements.

**Availability and Implementation:** MolShare is an open-source, freely available under a permissive MIT license. The source code is accessible at https://github.com/messiay/MolShare, and the application is deployed for live use at https://molshare.arjanapartners.in.

---

## 1. Introduction

Three-dimensional molecular visualization is essential to structural biology. Interpreting binding sites, protein-ligand interactions, and active site topology requires spatial context that flat sequence data cannot provide. Yet despite this necessity, collaborative structural analysis still relies on fragmented workflows — researchers share static screenshots, email raw .pdb files, or export complex session scripts, all of which strip away interactive context and place the burden of reconstruction on the recipient.

In spite of the necessity of Three-Dimensional visualization, the collaborative structural analysis relies on highly disoriented workflows. While powerful web-based viewers like Mol* [2] and NGL Viewer [3] provide excellent visualization, they primarily function as standalone viewers rather than native, multi-file collaborative workspaces. When A Researcher or a student needs to highlight a binding site, the most common way to capture it is to send a two-dimensional static screenshot or images and manually indicate drawing over it or by sending in a standalone .pdb or .pdbqt file via email. This fragmented approach removes the interactive context and the placement burden on the receiver's end to download and use the correct file, ensuring that they have the necessary desktop software installed and manually locate the exact region of interest.

Mol* [2], NGL Viewer [3] and iCn3D from the NIH provide excellent 3D view capabilities on their own, but there was no central location for shared collaboration among all users of these tools. Users often exported very complex state scripts or session files for sharing a single point of view in these tools. None of these tools provide an intrinsic multi-file architecture for users to upload proprietary PDB's in a secure environment while also being able to upload CSV file's and anchor persistent spatial comments on the PDB's. MolShare addresses these concerns by providing a dedicated URL-routable cloud workspace for collaborative structural biology.

MolShare addresses these structural bottlenecks by unifying interaction, Three-Dimensional visuals, metadata storage, and immediate and direct collaboration into a single shareable web link. Enabling spatially-Anchored, molecule-wise annotation, the platform ensures that all collaborators are viewing the exact same interactive three-dimensional state without requiring any local software installations or specialised computer hardware.

---

## 2. Architecture and Implementation

MolShare employs a new, Serverless web architecture that is designed to eliminate the need for a centralised graphical processing. The System Composed of three primary layers:

### 2.1 Frontend User Interface

The client-side application is developed using the Next.js [4] React framework and hosted on the Vercel Edge Network. This layer serves as the centralised workspace, dealing with user authentication, project routing, and the multi-file carousel interface that enables users to easily switch between different molecular representations.

### 2.2. Backend Data Persistence (Supabase)

File storage and relational data are handled by Supabase [5]. Large coordinate files (.pdb, .cif) and corresponding datasets (.csv) are stored in object storage. Project metadata, user relationships, and annotation coordinates are stored in a PostgreSQL database. Most importantly, when an annotation is created by a user, the database stores the precise Cartesian coordinates (X, Y, Z) of the chosen atom, thus irrevocably associating the user's text note with that particular point in space in the project. Row Level Security (RLS) policies enable the private or safe public sharing of projects through public URLs. Strict Row Level Security policies enforce owner-only write privileges, ensuring that while invited collaborators can interactively view the 3D state and read annotations, only the original project owner can append new spatial data. A dedicated 'Shared With Me' dashboard automatically tracks and routes authenticated users to projects they have been invited to view.

### 2.3. Client-Side Rendering (3Dmol.js)

To eliminate server-side rendering overhead, MolShare uses client-side rendering exclusively. When one accesses a URL for a project, the unrefined structural files are sent directly to the browser. The system then relies on the 3Dmol.js [1] library to tap into the local WebGL context of the user, rendering the molecule directly on the user's machine. This enables one to achieve a smooth framerate even on a student laptop with integrated graphics (Table 1).

---

## 3. Key Collaborative Features

### 3.1. Multi-File and Data Integration

Unlike conventional single-file browsers, MolShare allows for the simultaneous upload of multiple 3D files and CSV data into a single project. This allows for rapid comparative analysis, such as comparing multiple docked poses or wild-type versus mutant structures within the same browser window.

### 3.2. Spatially-Anchored Annotations

To overcome the "screenshot problem," MolShare includes an interactive annotation tool. Users can click on any particular atom within the 3D viewer to launch an annotation pop-up. Annotations are stored within the database and displayed as semi-transparent spheres and text labels directly on the 3D molecule. When a collaborator clicks on the shared link, they see the very same highlighted residues immediately, cutting down on potential communication errors by orders of magnitude.

---

## 4. Conclusion

MolShare removes two longstanding barriers in collaborative structural biology: the need for local software installation, and the absence of persistent spatial annotation in shared workflows. By offloading the entire graphical processing task to the client browser and establishing a URL-based, spatially-annotated collaborative workspace, it overcomes the hardware and software obstacles that have traditionally prevented students and early-career researchers from engaging with structural biology visualisation. Future development will focus on integrating real-time collaborative cursors and expanding support for rendering molecular dynamics (MD) trajectories.

---

## Acknowledgements

Artificial intelligence coding assistants (Antigravity) and large language models (Google Gemini) were utilized to assist in codebase generation, formatting, and structural outlining of this manuscript, in accordance with journal policies.

---

## Figure 1 — System Architecture & Data Model

### Panel A: System Architecture

![Figure 1A — MolShare system architecture showing client-side rendering via 3Dmol.js/WebGL, Vercel edge network, and Supabase backend.](figures/mermaid-drawing.png)

---

### Panel B: Entity-Relationship Diagram (Database)

![Figure 1B — Entity-relationship diagram showing the six principal database tables (Users, Projects, Project_Files, Annotations, Project_Views) and their foreign key relationships.](figures/mermaid-drawing%20(1).png)

---

## Figure 2 — User Interface

### Panel A: Dashboard with Repository & Shared With Me

![Figure 2A — MolShare dashboard showing the project repository table with owned projects and the Shared With Me section displaying a collaboratively shared project.](figures/fig2a_dashboard.png)

*The dashboard displays the project repository (top) listing the user's own projects with file counts, view counts, upload dates, and privacy status. Below it, the **Shared With Me** section shows projects that other users have shared with the current user, including the project owner's identity and the date it was last viewed—demonstrating MolShare's real-time collaborative workflow.*

---

### Panel B: Atom Annotation Popup

![Figure 2B — The AtomAnnotationPopup showing atom identity (ALA-195, Chain A), spatial coordinates, and the text input for adding contextual annotations.](figures/fig2b_annotation_popup.png)

*Clicking any atom in the 3D viewer triggers the AtomAnnotationPopup, which displays the atom's identity (residue, chain, serial number, Cartesian coordinates) and lists any existing annotations. Authenticated owners can add new spatially-anchored comments via the text input.*

---

### Panel C: Annotation Markers Rendered on the 3D Structure

![Figure 2C — Annotation markers rendered on the 3D structure showing "GLY304 traget" as a label with translucent sphere at the annotated atom position.](figures/fig2c_annotation_markers.png)

*Saved annotations are rendered as translucent spheres with text labels displaying the full comment content directly on the 3D structure. Labels persist across rotations and zoom operations, providing persistent spatial context for collaborative review.*

---

## Table 1 — Client-Side Rendering Performance

**Test Hardware:** AMD Ryzen (12 cores) / AMD Radeon 740M integrated GPU / 8 GB RAM / Windows 10 / Chrome 145

**Rendering mode:** cartoon + stick (same as MolShare default for proteins). Measurements via `performance.now()` and `requestAnimationFrame` over 5-second rotation intervals.

| PDB ID | Structure                 | Atom Count | File Size (KB) | Render Time (ms) | Re-render / Warm (ms) | Interactive FPS |
|--------|---------------------------|------------|----------------|-------------------|-----------------------|-----------------|
| 4HHB   | Hemoglobin tetramer       | 4,779      | 463            | **494**           | 5.0                   | **23.6**        |
| 1JFF   | Glutamate dehydrogenase   | 6,702      | 587            | **308**           | 3.9                   | **23.8**        |
| 1AON   | GroEL chaperonin          | 58,870     | 4,857          | **~1,900**        | ~22                   | **23.2**        |

**Notes:**
- Render time measures client-side computation only (model parsing + geometry generation + first WebGL draw call), excluding network fetch time.
- Interactive FPS measured during continuous Y-axis rotation via `requestAnimationFrame`.
- All tests performed on integrated graphics — discrete GPU hardware is expected to yield higher frame rates.

### Benchmark Proof

![Benchmark results (Hardware info + 4HHB) — showing AMD Radeon 740M GPU, 12 cores, 8 GB RAM, and Hemoglobin render time of 494ms.](figures/fig_benchmark_top.png)

![Benchmark results (1JFF + 1AON) — showing Glutamate DH render time of 308ms at 23.8 FPS, and GroEL FPS measurement of 23.2.](figures/fig_benchmark_results.png)

---

## References

[1] Rego, N., & Koes, D. (2015). 3Dmol.js: molecular visualization with WebGL. *Bioinformatics*, **31**(8), 1322–1324.

[2] Sehnal, D., et al. (2021). Mol* Viewer: modern web app for 3D macromolecular structure visualization. *Nucleic Acids Research*, **49**(W1), W431–W437.

[3] Rose, A. S., et al. (2018). NGL viewer: web-based molecular graphics for large complexes. *Bioinformatics*, **34**(21), 3755–3758.

[4] Vercel Inc. (2024). Next.js: The React Framework for the Web. Version 14. Retrieved from https://nextjs.org

[5] Supabase Inc. (2024). Supabase: The Open Source Firebase Alternative. Retrieved from https://supabase.com
