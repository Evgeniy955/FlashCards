# Flashcard Word Trainer

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1bgpqh9XUxwEQxsdnqcrPXrRmg78IX_9k

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Create a `.env` file in the root of your project and add your Firebase project configuration variables. You can find these values in your Firebase project settings ("Project settings" > "General" > "Your apps" > "SDK setup and configuration").
   ```
   VITE_FIREBASE_API_KEY="your-api-key"
   VITE_FIREBASE_AUTH_DOMAIN="your-auth-domain"
   VITE_FIREBASE_PROJECT_ID="your-project-id"
   VITE_FIREBASE_STORAGE_BUCKET="your-storage-bucket"
   VITE_FIREBASE_MESSAGING_SENDER_ID="your-messaging-sender-id"
   VITE_FIREBASE_APP_ID="your-app-id"
   VITE_FIREBASE_MEASUREMENT_ID="your-measurement-id"
   ```
3. Run the app:
   `npm run dev`

## Firebase Storage Setup (for saving custom dictionaries)

If you are having trouble saving dictionaries uploaded from your computer when you are logged in, it is likely due to a server-side configuration issue. Follow these steps to resolve it.

### 1. Enable Cloud Storage API

In your Google Cloud project that is associated with your Firebase project, ensure the **Cloud Storage API** is enabled. You can find this under "APIs & Services" > "Enabled APIs & services". If it's not enabled, search for it in the library and enable it.

### 2. Configure CORS

The most common issue is a missing CORS (Cross-Origin Resource Sharing) configuration on your Firebase Storage bucket. This prevents the browser from uploading files.

1.  **Install the `gsutil` tool:** This command-line tool is part of the Google Cloud SDK. Follow the [official installation instructions](https://cloud.google.com/storage/docs/gsutil_install).

2.  **Authenticate `gsutil`:** After installation, run `gcloud auth login` and `gcloud config set project YOUR_PROJECT_ID` in your terminal to authenticate with your Google account and set the correct project.

3.  **Apply the CORS configuration:** A `cors.json` file has been added to your project with the necessary settings. Run the following command in your terminal, replacing `YOUR_BUCKET_NAME` with your Firebase Storage bucket name (e.g., `my-project.appspot.com`):

    ```bash
    gsutil cors set cors.json gs://flashcard-755b8.firebasestorage.app
    ```

    You can find your bucket name in your Firebase project settings or in your `.env` file for the `VITE_FIREBASE_STORAGE_BUCKET` variable.

This will allow the web application to upload files to your Firebase Storage. It may take a few minutes for the settings to take effect.
