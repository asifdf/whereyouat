# AWS Deployment Setup

## Backend

1. Build the Spring Boot service with Docker:
   ```sh
   docker build -t whereyouat-backend ./backend
   ```
2. Push the image to Amazon ECR and deploy with Elastic Beanstalk or ECS.
3. The backend Dockerfile exposes port `8080` and packages the Spring Boot JAR.
4. Use `backend/aws-buildspec.yml` for AWS CodeBuild.

## Frontend

1. Build the React app and create a container image:
   ```sh
   docker build -t whereyouat-frontend ./frontend
   ```
2. The frontend Dockerfile uses Nginx to serve the static app.
3. Use `frontend/aws-buildspec.yml` for AWS Amplify or CodeBuild.
4. Alternatively deploy the `frontend/dist` folder to S3 + CloudFront.

## Notes

- The frontend uses `npm run build` to generate production files in `frontend/dist`.
- The backend is configured for AWS-compatible container deployment.
- Update `API_BASE` in `frontend/src/App.tsx` to the deployed backend URL when you deploy.
