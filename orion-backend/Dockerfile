# Stage 1: Build stage
FROM maven:3.9.6-eclipse-temurin-21-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: Runtime stage
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app

# Install Node.js, npm, and system libraries required by Playwright Chromium
RUN apk add --no-cache \
    nodejs \
    npm \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

COPY --from=builder /app/target/orion-backend-1.0.0-SNAPSHOT.jar app.jar
COPY src/main/resources/scripts /app/src/main/resources/scripts

# Install Node dependencies and Playwright browser binaries inside container during build
RUN cd /app/src/main/resources/scripts && npm install && npx playwright install chromium

ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
