"""OCR-path tests: the upload guards in ocr_image_bytes / ocr_pdf_bytes, and a real
end-to-end Stage 1 run (rendered bill -> Tesseract -> extract_line_items).

The guard tests need only Pillow + PyMuPDF. The end-to-end tests need the tesseract
binary: they skip locally when it is missing, but never in CI (CI installs it, and a
silently-skipped OCR test would be worse than a failing one)."""

import io
import os
import shutil

import fitz  # PyMuPDF
import pytest
from fastapi import HTTPException
from PIL import Image, ImageDraw, ImageFont

import backend

needs_tesseract = pytest.mark.skipif(
    shutil.which("tesseract") is None and not os.environ.get("CI"),
    reason="tesseract binary not installed",
)

BILL_LINES = [
    "ST. MARY HOSPITAL  AUSTIN TX 78704",
    "Account No 45219",
    "99213 Office visit, established patient 250.00",
    "70450 CT head without contrast 1,450.00",
    "36415 Routine venipuncture 22.00",
    "TOTAL CHARGES 1,722.00",
]
EXPECTED = [("99213", 250.0), ("70450", 1450.0), ("36415", 22.0)]


def png_bytes(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def render_bill_png() -> bytes:
    font = ImageFont.load_default(size=32)
    img = Image.new("RGB", (1400, 80 + 60 * len(BILL_LINES)), "white")
    draw = ImageDraw.Draw(img)
    for i, line in enumerate(BILL_LINES):
        draw.text((40, 40 + 60 * i), line, fill="black", font=font)
    return png_bytes(img)


def make_pdf(pages=1, width=612, height=792, lines=()) -> bytes:
    doc = fitz.open()
    for _ in range(pages):
        page = doc.new_page(width=width, height=height)
        for i, line in enumerate(lines):
            page.insert_text((50, 80 + 24 * i), line, fontsize=14)
    data = doc.tobytes()
    doc.close()
    return data


def extracted(text):
    return [(i["code"], i["charged"]) for i in backend.extract_line_items(text)]


class TestImageGuards:
    def test_unreadable_image_is_a_400(self):
        with pytest.raises(HTTPException) as exc:
            backend.ocr_image_bytes(b"\x89PNG\r\n\x1a\n" + b"truncated garbage")
        assert exc.value.status_code == 400

    def test_oversized_dimension_rejected_before_decode(self):
        img = Image.new("1", (backend.MAX_IMAGE_DIMENSION + 1, 1))
        with pytest.raises(HTTPException) as exc:
            backend.ocr_image_bytes(png_bytes(img))
        assert exc.value.status_code == 400
        assert "too large" in exc.value.detail

    @pytest.mark.filterwarnings("ignore::PIL.Image.DecompressionBombWarning")  # expected: it is one
    def test_pixel_bomb_rejected_before_decode(self):
        # Each side is under the dimension cap; the area is not. A 1-bit PNG this size
        # is a few KB on the wire and ~45 MP once decoded.
        img = Image.new("1", (9_000, 5_000))
        with pytest.raises(HTTPException) as exc:
            backend.ocr_image_bytes(png_bytes(img))
        assert exc.value.status_code == 400


class TestPdfGuards:
    def test_corrupt_pdf_is_a_400(self):
        with pytest.raises(HTTPException) as exc:
            backend.ocr_pdf_bytes(b"%PDF-1.7 not really a pdf")
        assert exc.value.status_code == 400

    def test_page_cap_enforced_before_rendering(self):
        with pytest.raises(HTTPException) as exc:
            backend.ocr_pdf_bytes(make_pdf(pages=backend.MAX_PDF_PAGES + 1))
        assert exc.value.status_code == 400
        assert str(backend.MAX_PDF_PAGES) in exc.value.detail

    def test_giant_page_rejected_before_rasterizing(self):
        # 14400pt at 200 DPI projects to 40,000 px: over the dimension cap.
        with pytest.raises(HTTPException) as exc:
            backend.ocr_pdf_bytes(make_pdf(width=14_400, height=200))
        assert exc.value.status_code == 400
        assert "too large" in exc.value.detail


@needs_tesseract
class TestStage1EndToEnd:
    """Real OCR on a synthetic bill. The header, account and total lines carry 5-digit
    numbers next to money-shaped values, so these also prove the non-item filters hold
    on actual Tesseract output, not just on hand-typed strings."""

    def test_png_bill(self):
        text = backend.ocr_image_bytes(render_bill_png())
        assert extracted(text) == EXPECTED

    def test_pdf_bill(self):
        text = backend.ocr_pdf_bytes(make_pdf(lines=BILL_LINES))
        assert text.startswith("--- Page 1 ---")
        assert extracted(text) == EXPECTED
