# MolShare 🧬

**MolShare** is a universal biological file SaaS platform designed to visualize, store, collaborate, and share molecular structures effortlessly.

---

## 🚀 Features

-   **Universal File Support**: Upload and visualize `.pdb`, `.sdf`, `.mol2`, `.xyz`, `.cif`, `.cube`, `.pqr`, `.csv` and AutoDock Vina docked complexes.
-   **Interactive 3D Workstation**: Powered by `3Dmol.js`, featuring representations (`Cartoon`, `Stick`, `Sphere`, `Line`, `Cross`), color schemes (`By Chain`, `By Element`, `By Residue`, `Secondary Structure`), and real-time Molecular Surface with smooth opacity controls.
-   **Data Versioning**: Seamless multi-file version management with interactive horizontal version timeline and instant lineage rollback.
-   **3D Atom Annotations**: Click any 3D atom to add spatial research notes, comments, and discussion threads.
-   **CSV Tabular Data Analysis**: Integrated spreadsheet preview for molecular datasets and docking affinity scores.
-   **Secure Cloud Storage**: All files are encrypted and stored using Supabase Storage and PostgreSQL RLS.

---

## 🛠️ Tech Stack

-   **Frontend**: Next.js 16 (App Router, Standalone Output)
-   **Styling**: Tailwind CSS v4, Lucide React
-   **Database & Auth**: Supabase (PostgreSQL, Row Level Security)
-   **3D Molecular Visualization**: 3Dmol.js
-   **Containerization**: Docker, Docker Compose
-   **CI/CD**: GitHub Actions
-   **Testing**: Jest, React Testing Library

---

## 📦 Local Development

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/messiay/MolShare.git
    cd MolShare
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    ```bash
    cp .env.example .env.local
    ```
    Add your Supabase credentials in `.env.local`:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

5.  **Run Tests & Linting**:
    ```bash
    npm test          # Run Jest unit test suite
    npm run lint      # Run ESLint code quality check
    npm run build     # Verify Next.js production build
    ```

---

## 🐳 Self-Hosting with Docker

Prerequisites: [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed.

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/messiay/MolShare.git
    cd MolShare
    ```

2.  **Copy environment template**:
    ```bash
    cp .env.example .env.local
    ```

3.  **Start all services with Docker Compose**:
    ```bash
    docker compose up --build
    ```

4.  **Access the applications**:
    - **MolShare Web Application**: [http://localhost:3000](http://localhost:3000)
    - **Supabase Studio (DB Management)**: [http://localhost:3001](http://localhost:3001)
    - **PostgreSQL Database**: `localhost:5432` (`postgres:postgres`)

---

## 🔄 CI/CD Pipeline

MolShare uses **GitHub Actions** for continuous integration. Every push and pull request to `main` or `dev` triggers automated workflow jobs:

-   **Lint Check**: Runs ESLint across the codebase for strict code quality.
-   **Test Suite**: Executes automated Jest unit and integration tests.
-   **Production Build Verification**: Validates full Next.js production compilation with standalone optimization.

---

## 🗄️ Database Schema & Versioning

Run the SQL scripts in your Supabase SQL Editor:
1. `schema.sql` — Core projects and user tables.
2. `versioning.sql` — Multi-version lineage tracking.
3. `interactive_features.sql` — 3D atom annotations and discussion threads.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
