"use client"

import { useEffect, useRef, useState } from "react"
import gsap from "gsap"
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg"

export default function Home() {
  const [text, setText] = useState("LOVE")
  const [recording, setRecording] = useState(false)
  const [playing, setPlaying] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])

  // Run animation
  const runAnimation = async () => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext("2d")!
    ctx.clearRect(0, 0, 540, 960)
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, 540, 960)

    // Animate with GSAP timeline
    const tl = gsap.timeline()

    const drawText = (scale: number, opacity: number, flash: boolean) => {
      ctx.clearRect(0, 0, 540, 960)
      ctx.fillStyle = "black"
      ctx.fillRect(0, 0, 540, 960)

      ctx.font = `${120 * scale}px SF Pro Display, sans-serif`
      ctx.fillStyle = "white"
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(text, 270, 480)

      if (flash) {
        ctx.fillStyle = "white"
        ctx.fillRect(0, 0, 540, 960)
      }
    }

    // Timeline steps
    tl.to({}, {
      duration: 0.3,
      onUpdate: () => drawText(gsap.utils.interpolate(0, 1.2, tl.progress()), 1, false)
    })
    .to({}, {
      duration: 0.1,
      onUpdate: () => drawText(1.0, 1, true) // flash
    })
    .to({}, {
      duration: 0.4,
      onUpdate: () => drawText(1.0, 1, false)
    })
    .to({}, {
      duration: 0.4,
      onUpdate: () => drawText(1.0, 1, false)
    })
    .to({}, {
      duration: 0.4,
      onUpdate: () => drawText(0.7, 0, false) // exit
    })

    return new Promise<void>((resolve) => {
      tl.eventCallback("onComplete", () => resolve())
    })
  }

  const recordAnimation = async () => {
    if (!canvasRef.current || !videoRef.current) return
    const canvas = canvasRef.current
    const stream = canvas.captureStream(30)
    streamRef.current = stream
    const recorder = new MediaRecorder(stream, { mimeType: "video/webm" })
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = async () => {
      const webmBlob = new Blob(chunksRef.current, { type: "video/webm" })

      // Convert to MP4
      const ffmpeg = createFFmpeg({ log: false })
      await ffmpeg.load()
      ffmpeg.FS("writeFile", "input.webm", await fetchFile(webmBlob))
      await ffmpeg.run("-i", "input.webm", "-c:v", "libx264", "output.mp4")
      const data = ffmpeg.FS("readFile", "output.mp4")

      const mp4Blob = new Blob([data.buffer], { type: "video/mp4" })
      const url = URL.createObjectURL(mp4Blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${text}.mp4`
      a.click()
    }

    recorder.start()
    setRecording(true)
    await runAnimation()
    recorder.stop()
    setRecording(false)
  }

  return (
    <main className="flex flex-col items-center gap-6">
      <div className="glass p-6 rounded-2xl shadow-xl flex flex-col gap-4 w-[600px] max-w-full">
        <h1 className="text-center text-2xl font-bold tracking-tight">Match Cut Generator</h1>

        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full p-3 rounded-lg glass text-black"
          placeholder="Enter your text..."
        />

        <div className="flex justify-center">
          <canvas
            ref={canvasRef}
            width={540}
            height={960}
            className="rounded-xl border border-white/20"
          />
        </div>

        <div className="flex gap-4 justify-center">
          <button
            onClick={recordAnimation}
            disabled={recording}
            className="px-6 py-3 rounded-lg bg-white/20 hover:bg-white/30 transition glass"
          >
            {recording ? "Recording..." : "Generate & Export MP4"}
          </button>
        </div>
      </div>
    </main>
  )
}
