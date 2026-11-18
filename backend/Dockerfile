# Backend image: Spring Boot on a full JDK (the runner compiles Java submissions with javac),
# plus Python 3 so Python submissions can be judged. Runs as an unprivileged user.

FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /src
COPY pom.xml .
RUN mvn -B -q dependency:go-offline
COPY src ./src
RUN mvn -B -q -DskipTests package && cp target/dsa-platform-*.jar /app.jar

FROM eclipse-temurin:21-jdk
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 10001 app
USER app
WORKDIR /home/app
COPY --from=build /app.jar app.jar
# The postgres profile reads DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD (see application.yml).
ENV SPRING_PROFILES_ACTIVE=postgres
# In a container, requests come from other containers (nginx), never from the container's own loopback.
ENV LOCAL_ONLY=false
EXPOSE 8081
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=60", "-jar", "app.jar"]
