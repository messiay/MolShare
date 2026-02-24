# BioCloud 🧬

**BioCloud** is a universal biological file SaaS platform designed to visualize, store, and share molecular structures effortlessly.

![BioCloud Hero](https://via.placeholder.com/1200x600?text=BioCloud+Dashboard)

## 🚀 Features

-   **Universal File Support**: Upload and visualize `.pdb`, `.sdf`, `.mol2`, `.xyz`, `.cif`, `.cube`, `.pqr` and more.
-   **Interactive 3D Viewer**: Powered by `3Dmol.js`, rendering complex molecular structures with high performance.
-   **Secure Cloud Storage**: All files are encrypted and stored using Supabase Storage.
-   **Notes & Collaboration**: Add research notes to your projects. Share public links with colleagues.
-   **Modern Dashboard**: clean, responsive UI built with Tailwind CSS.

## 🛠️ Tech Stack

-   **Frontend**: Next.js 14+ (App Router)
-   **Styling**: Tailwind CSS, Lucide React
-   **Database & Auth**: Supabase (PostgreSQL, GoTrue)
-   **Visualization**: 3Dmol.js

## 📦 Installation

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/yourusername/bioshare.git
    cd bioshare
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment**:
    Create a `.env.local` file in the root directory:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
    ```

4.  **Run Development Server**:
    ```bash
    npm run dev
    ```

## 🗄️ Database Setup

Run the following SQL in your Supabase SQL Editor to set up the required tables and policies:

```sql
-- Create projects table
create table public.projects (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  owner_id uuid references auth.users not null,
  title text not null,
  file_url text not null,
  file_extension text not null,
  is_public boolean default true,
  notes text
);

-- Enable RLS
alter table public.projects enable row level security;

-- (Add Policies from schema.sql)
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
