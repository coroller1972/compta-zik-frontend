import { computed, nextTick, onBeforeUnmount, reactive, ref, watch } from "./vendor/vue.esm-browser.prod.js";
import { AVATAR_SIZE, MAX_AVATAR_ZOOM, avatarCropRect } from "./avatar-crop.mjs";

export const AvatarCropDialog = {
  props: {
    file: { default: null },
    busy: { type: Boolean, default: false },
    error: { type: String, default: "" },
  },
  emits: ["cancel", "confirm"],
  setup(props, { emit }) {
    const dialog = ref(null);
    const canvas = ref(null);
    const loading = ref(false);
    const exporting = ref(false);
    const imageError = ref("");
    const dragging = ref(false);
    const crop = reactive({ width: 0, height: 0, zoom: 1, centerX: 0, centerY: 0 });
    const locked = computed(() => props.busy || exporting.value);
    const ready = computed(() => crop.width > 0 && !loading.value && !locked.value);
    let source = null;
    let sourceUrl = "";
    let generation = 0;
    let pointer = null;
    let previousOverflow = null;

    function disposeImage() {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
      sourceUrl = "";
      source = null;
      crop.width = crop.height = 0;
      pointer = null;
      dragging.value = false;
    }

    function closeDialog() {
      dialog.value?.close();
      if (previousOverflow !== null) document.body.style.overflow = previousOverflow;
      previousOverflow = null;
    }

    function draw(target = canvas.value) {
      if (!target || !source || !crop.width) return;
      const { x, y, size } = avatarCropRect(crop);
      const ctx = target.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, target.width, target.height);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(source, x, y, size, size, 0, 0, target.width, target.height);
    }

    function clampPosition() {
      const { x, y, size } = avatarCropRect(crop);
      crop.centerX = x + size / 2;
      crop.centerY = y + size / 2;
    }

    function reset() {
      if (!ready.value) return;
      crop.zoom = 1;
      crop.centerX = crop.width / 2;
      crop.centerY = crop.height / 2;
    }

    function zoomTo(value) {
      if (!ready.value) return;
      crop.zoom = Math.max(1, Math.min(MAX_AVATAR_ZOOM, Number(value)));
      clampPosition();
    }

    function pan(dx, dy) {
      if (!ready.value) return;
      const rect = avatarCropRect(crop);
      const ratio = rect.size / canvas.value.getBoundingClientRect().width;
      crop.centerX = rect.x + rect.size / 2 - dx * ratio;
      crop.centerY = rect.y + rect.size / 2 - dy * ratio;
      clampPosition();
    }

    function pointerDown(event) {
      if (!ready.value || pointer || event.button !== 0) return;
      canvas.value.focus({ preventScroll: true });
      canvas.value.setPointerCapture(event.pointerId);
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      dragging.value = true;
      event.preventDefault();
    }

    function pointerMove(event) {
      if (pointer?.id !== event.pointerId) return;
      pan(event.clientX - pointer.x, event.clientY - pointer.y);
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    }

    function pointerEnd(event) {
      if (pointer?.id !== event.pointerId) return;
      if (canvas.value.hasPointerCapture(event.pointerId)) canvas.value.releasePointerCapture(event.pointerId);
      pointer = null;
      dragging.value = false;
    }

    function moveWithKeyboard(event) {
      const step = event.shiftKey ? 30 : 10;
      const movements = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (!movements[event.key]) return;
      event.preventDefault();
      pan(...movements[event.key]);
    }

    function cancel() {
      if (!locked.value) emit("cancel");
    }

    async function confirm() {
      if (!ready.value) return;
      const currentGeneration = generation;
      exporting.value = true;
      imageError.value = "";
      try {
        const output = document.createElement("canvas");
        output.width = output.height = AVATAR_SIZE;
        draw(output);
        const blob = await new Promise(resolve => output.toBlob(resolve, "image/png"));
        if (generation !== currentGeneration) return;
        if (!blob) throw new Error("Impossible de préparer cette image. Essayez une autre photo.");
        emit("confirm", blob);
      } catch (error) {
        if (generation === currentGeneration) imageError.value = error.message || "Impossible de préparer cette image.";
      } finally {
        if (generation === currentGeneration) exporting.value = false;
      }
    }

    watch(() => props.file, async file => {
      const currentGeneration = ++generation;
      disposeImage();
      loading.value = Boolean(file);
      exporting.value = false;
      imageError.value = "";
      if (!file) {
        closeDialog();
        return;
      }
      await nextTick();
      if (generation !== currentGeneration) return;
      if (!dialog.value.open) {
        previousOverflow = document.body.style.overflow;
        dialog.value.showModal();
        document.body.style.overflow = "hidden";
      }
      try {
        if (file.type && !["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
          throw new Error("Choisissez une image PNG, JPEG ou WebP.");
        }
        if (file.size > 10 * 1024 * 1024) throw new Error("La photo dépasse la taille maximale de 10 Mo.");
        const image = new Image();
        sourceUrl = URL.createObjectURL(file);
        image.src = sourceUrl;
        try { await image.decode(); } catch { throw new Error("Cette image est illisible. Essayez une autre photo."); }
        if (generation !== currentGeneration) return;
        if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 25_000_000) {
          throw new Error("La photo dépasse 25 millions de pixels. Choisissez une version plus petite.");
        }
        source = image;
        Object.assign(crop, { width: image.naturalWidth, height: image.naturalHeight, zoom: 1,
          centerX: image.naturalWidth / 2, centerY: image.naturalHeight / 2 });
        loading.value = false;
        await nextTick();
        if (generation === currentGeneration) {
          draw();
          canvas.value.focus({ preventScroll: true });
        }
      } catch (error) {
        if (generation === currentGeneration) {
          disposeImage();
          imageError.value = error.message;
        }
      } finally {
        if (generation === currentGeneration) loading.value = false;
      }
    }, { immediate: true });

    watch(() => [crop.zoom, crop.centerX, crop.centerY], () => draw(), { flush: "post" });
    onBeforeUnmount(() => { generation += 1; disposeImage(); closeDialog(); });

    return { dialog, canvas, crop, loading, locked, ready, dragging, imageError,
      maxZoom: MAX_AVATAR_ZOOM, zoomTo, reset, pointerDown, pointerMove, pointerEnd, moveWithKeyboard, cancel, confirm };
  },
  template: `
    <dialog ref="dialog" class="avatar-crop-dialog" aria-labelledby="avatar-crop-title" aria-describedby="avatar-crop-help" @cancel.prevent="cancel">
      <div class="avatar-crop-heading">
        <div><p class="eyebrow">PHOTO DE PROFIL</p><h2 id="avatar-crop-title">Recadrer la photo</h2></div>
        <button type="button" class="avatar-crop-close" aria-label="Fermer le recadrage" :disabled="locked" @click="cancel"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m6 6 12 12M18 6 6 18" /></svg></button>
      </div>
      <p id="avatar-crop-help" class="avatar-crop-help">Zoomez, puis faites glisser la photo dans le cadre. Les flèches du clavier permettent aussi de la déplacer.</p>
      <div v-if="loading" class="avatar-crop-loading" role="status">Chargement de la photo…</div>
      <div v-show="crop.width" :class="['avatar-crop-stage', { dragging, locked }]">
        <canvas ref="canvas" width="640" height="640" tabindex="0" role="group" aria-label="Photo à recadrer" aria-describedby="avatar-crop-help"
          @pointerdown="pointerDown" @pointermove="pointerMove" @pointerup="pointerEnd" @pointercancel="pointerEnd" @lostpointercapture="pointerEnd" @keydown="moveWithKeyboard"></canvas>
        <div class="avatar-crop-grid" aria-hidden="true"></div>
      </div>
      <div v-if="crop.width" class="avatar-crop-controls">
        <div class="avatar-crop-zoom-label"><label for="avatar-crop-zoom">Zoom</label><output for="avatar-crop-zoom">{{ Math.round(crop.zoom * 100) }} %</output></div>
        <input id="avatar-crop-zoom" type="range" min="1" :max="maxZoom" step="0.01" :value="crop.zoom" :disabled="!ready" @input="zoomTo($event.target.value)" />
        <button type="button" class="avatar-crop-reset" :disabled="!ready" @click="reset">Réinitialiser le cadrage</button>
      </div>
      <p v-if="imageError || error" class="form-warning avatar-crop-error" role="alert">{{ imageError || error }}</p>
      <div class="avatar-crop-actions">
        <button type="button" class="ghost-button" :disabled="locked" @click="cancel">Annuler</button>
        <button type="button" class="primary-button" :disabled="!ready" @click="confirm">{{ locked ? 'Envoi en cours…' : 'Valider le recadrage' }}</button>
      </div>
    </dialog>
  `,
};
