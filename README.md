# LoFi AI Studio [![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) [![Local First](https://img.shields.io/badge/Philosophy-Privacy--First-green)](#local-first-privacy-by-default)

> A unified, open-source dashboard for running local AI models across text, image, video, and audio modalities — all on your own hardware with zero data leaving by default.


Support the Developer-
Paypal (preferred): https://www.paypal.me/brandonreeddev
Patreon: https://www.patreon.com/cw/BrandonReed_Dev

## Overview

LoFi AI Studio is a web-based dashboard that enables users to discover, configure, and run AI models across text, image, video, and audio modalities — all from a single unified interface. The dashboard prioritizes local model execution for privacy and cost efficiency, while offering manual switching to cloud providers for tasks that exceed local hardware capabilities.

## Features

### M0 - Foundations ✅
- ✅ Monorepo structure with npm workspaces
- ✅ React + Vite frontend with TypeScript
- ✅ Express backend with TypeScript
- ✅ JSON-based database for settings and jobs
- ✅ Ollama adapter for text models
- ✅ ComfyUI adapter for image and video models
- ✅ Model discovery and selection
- ✅ Local/Cloud execution mode toggle
- ✅ Streaming text chat via WebSocket

### M1 - Text MVP ✅
- ✅ Chat interface with streaming output
- ✅ Parameter panel (temperature, top-p, max tokens)
- ✅ System prompt support
- ✅ Manual Local/Cloud toggle with confirmation
- ✅ Context documents (TXT, MD, PDF upload)
- ✅ Prompt templates with variable substitution
- ✅ Output export (copy to clipboard, download as TXT/MD)
- ✅ Message editing, reactions, and replies
- ✅ @mention agent invocation in chat
- ✅ Chat memory (window, summary, hybrid modes)
- ✅ Voice input/output integration

### M2 - Image MVP ✅
- ✅ Text-to-image generation via ComfyUI
- ✅ Image-to-image transformation
- ✅ Parameter panel for diffusion models (steps, CFG, sampler, scheduler)
- ✅ Output gallery with grid/single view
- ✅ Image metadata display (seed, steps, CFG, dimensions)
- ✅ Download generated images
- ✅ Save/load generation configs
- ✅ ComfyUI workflow import/export and conversion
- [ ] Cloud toggle with cost estimate

### M3 - Audio MVP ✅
- ✅ Local audio panel for speech-to-text and text-to-speech
- ✅ Qwen3-ASR local adapter via wrapper service
- ✅ Qwen3-TTS local adapter via wrapper service
- ✅ Independent STT and TTS model selection
- ✅ Browser recording support with WAV conversion for local transcription
- ✅ Audio file upload and recording
- ✅ Configurable STT/TTS parameters (language, speed, pitch, output format)
- [ ] ElevenLabs cloud integration

### M4 - Video MVP ✅
- ✅ Text-to-video generation via ComfyUI + Wan 2.2
- ✅ In-browser video preview and download
- ✅ Video parameter panel for frames, FPS, steps, CFG, seed, and dimensions
- ✅ Video model discovery through the ComfyUI adapter
- ✅ Video generation with duration and frame count metadata
- [ ] Image-to-video workflow integration from a proven ComfyUI graph

### M5 - Orchestration MVP ✅
- ✅ Agent management with personas, skills, and memory
- ✅ Skill system with HTTP, internal, and workflow execution types
- ✅ Workflow visual editor with node-based design
- ✅ Workflow import/export (including ComfyUI/n8n conversion)
- ✅ Marketplace for skills and workflows
- ✅ Group chat for multi-agent conversations
- ✅ Agent chat panel for direct agent interaction
- ✅ Task scheduling with cron expressions
- ✅ Storage browser for local and runtime file systems
- ✅ Activity feed and system dashboard
- ✅ Agent skill management capabilities (read/create/update/delete)

### M5.5 - Polish (Planned)
- Job queue UI with detailed views
- History with execution mode tracking and filtering
- Usage log for cloud jobs with cost analysis
- Enhanced analytics and metrics

## Architecture

```
lofiaistudio/
├── apps/
│   ├── web/                    # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── panels/         # Modality panels
│   │   │   ├── stores/         # Zustand stores
│   │   │   └── lib/            # Utilities
│   │   └── package.json
│   └── server/                 # Node.js backend
│       ├── src/
│       │   ├── adapters/       # Runtime adapters
│       │   ├── routes/         # API routes
│       │   └── db/             # Database schema
│       └── package.json
├── packages/
│   └── shared/                 # Shared types and utilities
└── package.json                # Root workspace
```

## Tech Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS + shadcn/ui components
- **State Management:** Zustand
- **Icons:** Lucide React
- **Workflow Engine:** @xyflow/react
- **UI Components:** Radix UI primitives

### Backend
- **Runtime:** Node.js + Express
- **Database:** SQLite with Drizzle ORM
- **Real-time:** WebSocket for streaming
- **Audio Processing:** FastAPI-based Qwen3 wrapper service

## Supported Runtimes

- **Text:** Ollama
- **Image:** ComfyUI
- **Audio:** Qwen3-ASR, Qwen3-TTS via local wrapper service
- **Video:** ComfyUI
- **Orchestration:** Built-in task scheduler, agent system, workflow engine

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- Ollama (for text models) - optional
- ComfyUI (for image and video models) - optional
- Python 3.8+ (for Qwen3 audio wrapper) - optional

### Installation

```bash
# Install dependencies
npm install

# Build shared package
npm run build --workspace=@lofiaistudio/shared

# Start development servers
npm run dev
```

This will start:
- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Configuration

The application stores configuration in `~/.lofiaistudio/`:
- `lofiaistudio.db` - SQLite database
- `outputs/` - Generated outputs
- `config.json` - User settings

Runtime endpoints can be configured via environment variables:
- `OLLAMA_ENDPOINT` - Ollama API endpoint (default: http://localhost:11434)
- `COMFYUI_ENDPOINT` - ComfyUI API endpoint (default: http://localhost:8188)
- `QWEN3_AUDIO_ENDPOINT` - Qwen3 audio wrapper endpoint (default: http://localhost:8001)

## Usage

### Text Chat
1. Ensure Ollama is running with a model loaded
2. Select a model from the dropdown
3. Type a message and press Enter
4. Watch the streaming response
5. Use @ to mention agents for specialized tasks
6. React to messages, reply, or edit as needed

### Audio
1. Start the Qwen3 audio wrapper service
2. Open the Audio panel
3. Pick a Qwen3 ASR model for transcription or a Qwen3 TTS voice/model for synthesis
4. Upload or record audio for STT, or enter text for TTS
5. Configure parameters (language, speed, pitch, output format)
6. Run the job and preview the result in-browser

On first use, the wrapper may download Qwen model files from Hugging Face before serving the first transcription or synthesis request.

Notes:
- The wrapper loads models lazily, so the first audio request can take longer than later requests.
- The current local wrapper uses `cpu` + `float32` defaults for stability on Windows.
- Qwen TTS may warn about missing SoX on Windows; synthesis can still work without the SoX CLI.

### Video
1. Ensure ComfyUI is running and your Wan 2.2 video workflow dependencies are installed.
2. Confirm ComfyUI has access to:
   - `wan2.2_ti2v_5B_fp16.safetensors`
   - `umt5_xxl_fp8_e4m3fn_scaled.safetensors`
   - `wan2.2_vae.safetensors`
3. Open the Video panel in LoFi AI Studio.
4. Select the Wan video model discovered from ComfyUI.
5. Enter a prompt, tune frames/FPS if needed, and generate the clip.
6. Preview the generated video in-browser and download if desired.

The current Video MVP uses the proven ComfyUI Wan text-to-video graph. Image-to-video can be added once a matching reference-image workflow is finalized.

### Group Chat
1. Navigate to the Agents panel and create agents with different personas, skills, and models
2. Go to the Group Chat panel
3. Create a new room and add agents to it
4. Send a message to the room - all agents will receive and respond to it
5. Agents can see each other's responses and collaborate on tasks

### Agent Chat
1. Open the Agents panel and select an agent
2. Click the chat button to open a direct chat with that agent
3. The agent will respond using its configured skills, model, and personality
4. Use this for focused interactions with specific agents

### Workflows
1. Navigate to the Workflows panel
2. Create a new workflow or import one (JSON, ComfyUI, or n8n format)
3. Use the visual editor to connect nodes (triggers, models, skills, outputs)
4. Configure each node's parameters in the inspector panel
5. Save the workflow and run it manually or set up a schedule
6. View runs and toast notifications from output nodes

### Skills
1. Go to the Skills panel
2. Create new skills (HTTP calls, workflow triggers, or internal logic)
3. Organize skills by category
4. Enable/disable skills as needed
5. Assign skills to agents in the Agents panel
6. Skills with HTTP execution type can call external APIs
7. Skills with workflow execution type can trigger other workflows

### Storage
1. Visit the Storage panel to browse files from connected runtimes
2. Navigate through directories and preview files
3. Download files or open them in a new tab
4. View storage source information and available space

### Tasks & Schedules
1. Access the Tasks panel to create scheduled jobs
2. Define cron expressions for when tasks should run
3. Link tasks to workflows for automated execution
4. Monitor task history and upcoming runs
5. View heatmap of scheduled activity

### Local vs actual vs scheduled execution times

### Local vs Cloud Mode
- **Local** (default): All inference runs on your hardware
- **Cloud**: Requires API keys and explicit confirmation before each job

The app **never** automatically switches to cloud mode - you must explicitly enable it.

## API Reference

### REST Endpoints

```
GET  /api/runtimes          # Get all runtime statuses
POST /api/runtimes/connect  # Connect to all runtimes
GET  /api/models/:modality  # Get models for a modality
POST /api/models/:runtime/:modelId/load   # Load a model
POST /api/models/:runtime/:modelId/unload # Unload a model
POST /api/text/chat         # Chat completion (non-streaming)
POST /api/text/complete     # Text completion
POST /api/audio/transcribe  # Speech-to-text via selected audio runtime/model
POST /api/audio/synthesize  # Text-to-speech via selected audio runtime/model
POST /api/video/text-to-video # Text-to-video via selected video runtime/model
POST /api/video/image-to-video # Reserved for image-to-video workflow support
GET  /api/settings          # Get app settings
PUT  /api/settings          # Update app settings
POST /api/storage/sources   # List storage sources
POST /api/storage/list/:sourceId  # List files in a storage source
POST /api/storage/read      # Read file content
POST /api/storage/delete    # Delete a file
```

### WebSocket

Connect to `/ws` for streaming text generation:

```javascript
const ws = new WebSocket('ws://localhost:3001/ws');

ws.send(JSON.stringify({
  type: 'chat',
  payload: {
    modelId: 'llama2',
    messages: [{ role: 'user', content: 'Hello!' }],
    params: { temperature: 0.7 },
    requestId: 'uuid'
  }
}));

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data.type: 'token' | 'complete' | 'error'
};
```

## Development

### Scripts

```bash
npm run dev          # Start both frontend and backend
npm run dev:web      # Start frontend only
npm run dev:server   # Start backend only
npm run build        # Build all packages
npm run lint         # Run ESLint
npm run typecheck    # Run TypeScript checks
```

### Qwen3 Audio Wrapper Setup

Use [setup-qwen3-audio.ps1](/setup-qwen3-audio.ps1) to scaffold a local Python environment for a Qwen3 audio wrapper service. The app expects a wrapper with:

- `GET /health`
- `GET /models`
- `POST /transcribe`
- `POST /synthesize`

After running the setup script:

1. Open `qwen3-audio-wrapper` directory
2. Run `.\start-qwen3-audio.ps1`
3. Wait for the wrapper to come up on `http://localhost:8001`
4. Start LoFi AI Studio and refresh runtimes if needed

Notes:

- The wrapper loads models lazily, so the first audio request can take longer than later requests.
- The current local wrapper uses `cpu` + `float32` defaults for stability on Windows.
- Qwen TTS may warn about missing SoX on Windows; synthesis can still work without the SoX CLI for the current LoFi AI Studio flow.

### Adding a New Runtime Adapter

1. Create a new adapter in `apps/server/src/adapters/`
2. Extend `BaseRuntimeAdapter` and implement the required interface
3. Register the adapter in `apps/server/src/adapters/index.ts`
4. Add the runtime type to shared types if needed

## Contributing

Contributions are welcome, but please wait for Version 0.2.0 when the Foundation is set (in order to not build on faulty foundation).
Until then, please like and bookmark this project for future contributions.

## License

This project is licensed under the [MIT](./LICENSE).
