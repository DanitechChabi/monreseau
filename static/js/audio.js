/* ============================================================
   MonRéseau — Audio Recorder (style WhatsApp)
   + Audio Player
   ============================================================ */

(function () {
    'use strict';

    /* ---------- Enregistreur audio (style WhatsApp) ---------- */

    class AudioRecorder {
        constructor(btnEl, onBlob) {
            this.btn = btnEl;
            this.onBlob = onBlob;
            this.mediaRecorder = null;
            this.stream = null;
            this.chunks = [];
            this.recording = false;
            this.startTime = 0;
            this.timerInterval = null;

            // Container principal
            this.container = this.btn.closest('.audio-recorder') || this.btn.parentElement;

            // Éléments UI WhatsApp
            this.panel = null;
            this.timerEl = null;
            this.waveEl = null;
            this.cancelBtn = null;
            this.sendBtn = null;

            this.btn.addEventListener('click', () => this.toggle());
        }

        async toggle() {
            if (this.recording) {
                this.stopAndSend();
            } else {
                await this.start();
            }
        }

        async start() {
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                this.mediaRecorder = new MediaRecorder(this.stream);
                this.chunks = [];
                this.recording = true;

                this.mediaRecorder.ondataavailable = (e) => {
                    if (e.data.size > 0) this.chunks.push(e.data);
                };

                this.mediaRecorder.onstop = () => {
                    const blob = new Blob(this.chunks, { type: 'audio/webm' });
                    const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' });
                    this.stream.getTracks().forEach(t => t.stop());
                    if (this.onBlob) this.onBlob(file);
                };

                this.mediaRecorder.start();
                this._showRecordingUI();
            } catch (err) {
                console.error('Micro non disponible :', err);
            }
        }

        stopAndSend() {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            clearInterval(this.timerInterval);
            this.recording = false;
            this._hideRecordingUI();
        }

        cancel() {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
            clearInterval(this.timerInterval);
            this.recording = false;
            this.chunks = [];
            this._hideRecordingUI();
        }

        _showRecordingUI() {
            this.btn.style.display = 'none';

            this.panel = document.createElement('div');
            this.panel.className = 'whatsapp-rec-panel';
            this.panel.innerHTML = `
                <button type="button" class="whatsapp-rec-cancel" title="Annuler">
                    <i class="bi bi-trash"></i>
                </button>
                <div class="whatsapp-rec-pulse"></div>
                <div class="whatsapp-rec-timer">0:00</div>
                <div class="whatsapp-rec-waves">
                    <span class="whatsapp-wave"></span>
                    <span class="whatsapp-wave"></span>
                    <span class="whatsapp-wave"></span>
                    <span class="whatsapp-wave"></span>
                    <span class="whatsapp-wave"></span>
                </div>
                <div class="whatsapp-rec-hint">Glissez pour annuler</div>
                <button type="button" class="whatsapp-rec-send" title="Envoyer">
                    <i class="bi bi-arrow-up-circle-fill"></i>
                </button>
            `;

            this.cancelBtn = this.panel.querySelector('.whatsapp-rec-cancel');
            this.sendBtn = this.panel.querySelector('.whatsapp-rec-send');
            this.timerEl = this.panel.querySelector('.whatsapp-rec-timer');
            this.waveEl = this.panel.querySelector('.whatsapp-rec-waves');

            this.cancelBtn.addEventListener('click', () => this.cancel());
            this.sendBtn.addEventListener('click', () => this.stopAndSend());

            this.container.appendChild(this.panel);
            this.startTime = Date.now();
            this.timerInterval = setInterval(() => this._tick(), 200);
        }

        _hideRecordingUI() {
            if (this.panel) {
                this.panel.remove();
                this.panel = null;
            }
            this.btn.style.display = '';
        }

        _tick() {
            const s = Math.floor((Date.now() - this.startTime) / 1000);
            this.timerEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
        }
    }

    /* ---------- Lecteur audio ---------- */

    function initAudioPlayers(container) {
        (container || document).querySelectorAll('.audio-player[data-src]').forEach(player => {
            if (player._audioInit) return;
            player._audioInit = true;

            const btn = player.querySelector('.audio-player-btn');
            const fill = player.querySelector('.audio-progress-fill');
            const timeEl = player.querySelector('.audio-time');
            const src = player.dataset.src;
            const audio = new Audio(src);

            btn.addEventListener('click', () => {
                if (audio.paused) {
                    // Pause all other playing audios
                    document.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
                    audio.play();
                    btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                } else {
                    audio.pause();
                    btn.innerHTML = '<i class="bi bi-play-fill"></i>';
                }
            });
            audio.addEventListener('timeupdate', () => {
                if (audio.duration) {
                    fill.style.width = (audio.currentTime / audio.duration * 100) + '%';
                    const rem = Math.ceil(audio.duration - audio.currentTime);
                    timeEl.textContent = `${Math.floor(rem / 60)}:${String(rem % 60).padStart(2, '0')}`;
                }
            });
            audio.addEventListener('ended', () => {
                btn.innerHTML = '<i class="bi bi-play-fill"></i>';
                fill.style.width = '0%';
            });
        });
    }

    window.AudioRecorder = AudioRecorder;
    window.initAudioPlayers = initAudioPlayers;
    document.addEventListener('DOMContentLoaded', () => initAudioPlayers());
})();
