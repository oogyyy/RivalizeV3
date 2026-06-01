FROM golang:1.24-alpine AS builder

RUN apk add --no-cache git

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o go-parser .

FROM alpine:3.19
RUN apk add --no-cache ca-certificates

WORKDIR /app
COPY --from=builder /app/go-parser .

EXPOSE 8080
ENV PORT=8080

# GOGC=75: collect when heap grows 75% above live set (default 100%).
# Slightly more frequent GC than default gives a better peak-memory/throughput
# balance on Railway Pro without sacrificing much parse speed.
ENV GOGC=75

# GOMEMLIMIT: hard ceiling so the OOM killer never surprises us.
# Set to 1.8 GB — sized for a 2 GB Railway replica (leaves ~200 MB for OS/stacks).
# Override via Railway service environment variable if you resize the service.
ENV GOMEMLIMIT=1932735283

CMD ["./go-parser"]
