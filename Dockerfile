FROM node:24-alpine AS frontend
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY index.html tsconfig.json vite.config.ts style.css ./
COPY src ./src
RUN npm run build

FROM maven:3.9-eclipse-temurin-25 AS backend
WORKDIR /app/backend
COPY backend/pom.xml ./
RUN mvn -B --no-transfer-progress dependency:go-offline
COPY backend/src ./src
COPY api/openapi.json /app/api/openapi.json
COPY --from=frontend /app/dist /app/dist
RUN mvn -B --no-transfer-progress package -DskipTests

FROM eclipse-temurin:25-jre-alpine
WORKDIR /app
RUN addgroup -S studio && adduser -S studio -G studio
COPY --from=backend /app/backend/target/diagram-studio-1.0.0.jar app.jar
USER studio
EXPOSE 8090
ENTRYPOINT ["java", "-jar", "app.jar"]
