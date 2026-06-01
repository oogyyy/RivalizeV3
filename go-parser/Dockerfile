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

# Tune GC to collect more frequently, keeping peak heap smaller.
# GOGC=50 → collect when heap grows 50% above live set (default is 100%).
ENV GOGC=50

# Hard memory ceiling in bytes (leave headroom for OS + goroutine stacks).
# Adjust this to match your Railway service memory limit.
# Example: 512 MiB service → set to 450 MiB (471859200)
# Unset means no ceiling (default). Set via Railway env var to override.
# ENV GOMEMLIMIT=471859200

CMD ["./go-parser"]
