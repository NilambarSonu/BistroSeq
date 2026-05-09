# Vercel Deployment Guide for BistroSeq 🍷

BistroSeq is optimized for **Vercel**. Since it is a client-side application, you can host it for free on the Vercel Hobby plan with zero server costs.

## One-Click Deployment Setup

1.  **Push your code to GitHub**, GitLab, or Bitbucket.
2.  Go to the [Vercel Dashboard](https://vercel.com/dashboard) and click **"Add New"** > **"Project"**.
3.  Import your repository.
4.  **CRITICAL STEP:** Under "Project Settings", find the **Root Directory** field and set it to `frameforge`.
    *   This tells Vercel that the Next.js app is inside the `frameforge` folder, not at the very top of the repo.
5.  Vercel will automatically detect **Next.js** as the framework.
6.  Click **Deploy**.

## Deployment Details

*   **Build Command:** `npm run build` (Automatically detected)
*   **Output Directory:** `.next` (Automatically detected)
*   **Install Command:** `npm install` (Automatically detected)

## Why Vercel?

*   **Global CDN:** Your artisanal UI will load instantly from anywhere in the world.
*   **Auto-HTTPS:** SSL certificates are managed for you.
*   **Zero Cost:** As long as you stay on the Hobby tier, you pay $0.
*   **Preview Deployments:** Every pull request gets a unique URL to test changes before they go live.

---

*Handcrafted for BistroSeq by Gemini CLI.*
