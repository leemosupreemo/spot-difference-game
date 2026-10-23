#!/usr/bin/env python3
"""
Generates the 5-slide Diff Hunter launch carousel for Instagram (1080x1350, 4:5 ratio).
Follows social media best practices, exact layout specs, and official brand assets.
"""

import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUTPUT_DIR = "_marketing/social_media/launch_carousel"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Dimensions
CANVAS_W, CANVAS_H = 1080, 1350
BG_COLOR = (11, 15, 25) # Sleek dark slate
CARD_BG = (18, 24, 38)
TEXT_WHITE = (255, 255, 255)
TEXT_MUTED = (148, 163, 184) # Slate 400
ACCENT_BLUE = (56, 189, 248) # Sky 400
ACCENT_CYAN = (34, 211, 238)
ACCENT_GREEN = (74, 222, 128)
BORDER_COLOR = (30, 41, 59)

# Fonts
FONT_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"
def get_font(size, bold=False):
    index = 1 if bold else 0
    return ImageFont.truetype(FONT_PATH, size=size, index=index)

def draw_arrow_right(draw, cx, cy, size=12, color=TEXT_WHITE, width=3):
    draw.line([(cx - int(size * 1.5), cy), (cx, cy)], fill=color, width=width)
    draw.line([(cx - int(size * 0.7), cy - int(size * 0.7)), (cx, cy)], fill=color, width=width)
    draw.line([(cx - int(size * 0.7), cy + int(size * 0.7)), (cx, cy)], fill=color, width=width)

def draw_arrow_up(draw, cx, cy, size=10, color=TEXT_WHITE, width=3):
    draw.line([(cx, cy + int(size * 1.5)), (cx, cy)], fill=color, width=width)
    draw.line([(cx - int(size * 0.7), cy + int(size * 0.7)), (cx, cy)], fill=color, width=width)
    draw.line([(cx + int(size * 0.7), cy + int(size * 0.7)), (cx, cy)], fill=color, width=width)

def create_base_canvas():
    img = Image.new("RGB", (CANVAS_W, CANVAS_H), BG_COLOR)
    draw = ImageDraw.Draw(img)
    # Subtle top radial glow
    for r in range(400, 0, -20):
        alpha = int((1.0 - r / 400.0) * 25)
        color = (15 + alpha, 23 + alpha * 2, 42 + alpha * 3)
        draw.ellipse([(CANVAS_W//2 - r, -r//2), (CANVAS_W//2 + r, r//2 + 200)], fill=color)
    return img

# Assets
BASE_IMG_PATH = "_marketing/social_media/social_15_base_batch/01_arch_parisian_bakery.jpg"
ALT_IMG_PATH = "_marketing/social_media/social_15_base_batch/01_arch_parisian_bakery_var1_variant.jpg"
GAMEPLAY_SHOT = "screenshots/app_store_6.5_inch/02_gameplay_photography.png"
LEADERBOARD_SHOT = "screenshots/app_store_6.5_inch/04_scores_leaderboard.png"
APP_ICON_PATH = "_design/app-icon-master.png"

# ==========================================
# SLIDE 1: THE HOOK
# ==========================================
def render_slide_1():
    slide = create_base_canvas()
    draw = ImageDraw.Draw(slide)
    
    # 1. Top label: Centered at y ≈ 90
    top_label = "DIFF HUNTER  ·  NOW LIVE"
    f_top = get_font(24, bold=True)
    bbox = draw.textbbox((0, 0), top_label, font=f_top)
    w_text = bbox[2] - bbox[0]
    draw.text(((CANVAS_W - w_text) // 2, 85), top_label, font=f_top, fill=ACCENT_BLUE)
    
    # 2. Main headline: y ≈ 160-260
    f_head = get_font(68, bold=True)
    l1 = "ONE DIFFERENCE."
    l2 = "CAN YOU FIND IT?"
    b1 = draw.textbbox((0, 0), l1, font=f_head)
    b2 = draw.textbbox((0, 0), l2, font=f_head)
    draw.text(((CANVAS_W - (b1[2] - b1[0])) // 2, 140), l1, font=f_head, fill=TEXT_WHITE)
    draw.text(((CANVAS_W - (b2[2] - b2[0])) // 2, 218), l2, font=f_head, fill=TEXT_WHITE)
    
    # 3. Two puzzle images side by side:
    # Specs: Left: x = 70, y = 330, w = 455, h = 640
    #        Right: x = 555, y = 330, w = 455, h = 640
    #        Gap = 30
    puz_w, puz_h = 455, 640
    im_a = Image.open(BASE_IMG_PATH).resize((puz_w, puz_h), Image.Resampling.LANCZOS)
    im_b = Image.open(ALT_IMG_PATH).resize((puz_w, puz_h), Image.Resampling.LANCZOS)
    
    # Draw frame backgrounds with subtle borders
    draw.rounded_rectangle([68, 328, 68 + puz_w + 4, 328 + puz_h + 4], radius=16, fill=BORDER_COLOR)
    draw.rounded_rectangle([553, 328, 553 + puz_w + 4, 328 + puz_h + 4], radius=16, fill=BORDER_COLOR)
    
    # Paste images
    mask = Image.new("L", (puz_w, puz_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, puz_w, puz_h], radius=14, fill=255)
    slide.paste(im_a, (70, 330), mask)
    slide.paste(im_b, (555, 330), mask)
    
    # Image Labels (A vs B)
    f_lbl = get_font(20, bold=True)
    draw.rounded_rectangle([85, 345, 125, 380], radius=8, fill=(0, 0, 0, 180))
    draw.text((98, 350), "A", font=f_lbl, fill=TEXT_WHITE)
    draw.rounded_rectangle([570, 345, 610, 380], radius=8, fill=(0, 0, 0, 180))
    draw.text((583, 350), "B", font=f_lbl, fill=TEXT_WHITE)
    
    # 4. Bottom prompt
    f_swipe = get_font(30, bold=True)
    swipe_text = "Swipe to explore"
    b_sw = draw.textbbox((0, 0), swipe_text, font=f_swipe)
    sw_w = b_sw[2] - b_sw[0]
    
    # Pill button
    pill_w = sw_w + 90
    pill_x = (CANVAS_W - pill_w) // 2
    draw.rounded_rectangle([pill_x, 1025, pill_x + pill_w, 1095], radius=35, fill=(30, 41, 59))
    draw.rounded_rectangle([pill_x, 1025, pill_x + pill_w, 1095], radius=35, outline=ACCENT_BLUE, width=2)
    draw.text((pill_x + 32, 1042), swipe_text, font=f_swipe, fill=TEXT_WHITE)
    draw_arrow_right(draw, pill_x + pill_w - 30, 1060, size=12, color=ACCENT_BLUE, width=3)
    
    # 5. Logo / Brand signature at bottom
    f_brand = get_font(22, bold=True)
    brand_text = "D I F F   H U N T E R"
    b_br = draw.textbbox((0, 0), brand_text, font=f_brand)
    draw.text(((CANVAS_W - (b_br[2] - b_br[0])) // 2, 1170), brand_text, font=f_brand, fill=TEXT_MUTED)
    
    out_path = os.path.join(OUTPUT_DIR, "slide_1_hook.png")
    slide.save(out_path, quality=95)
    print("Saved:", out_path)

# ==========================================
# SLIDE 2: GAMEPLAY SCREENSHOT
# ==========================================
def render_slide_2():
    slide = create_base_canvas()
    draw = ImageDraw.Draw(slide)
    
    # Top text
    top_label = "GAMEPLAY"
    f_top = get_font(24, bold=True)
    b_top = draw.textbbox((0, 0), top_label, font=f_top)
    draw.text(((CANVAS_W - (b_top[2] - b_top[0])) // 2, 70), top_label, font=f_top, fill=ACCENT_BLUE)
    
    f_head = get_font(60, bold=True)
    h1 = "FIND IT. BEAT THE CLOCK."
    b_h1 = draw.textbbox((0, 0), h1, font=f_head)
    draw.text(((CANVAS_W - (b_h1[2] - b_h1[0])) // 2, 115), h1, font=f_head, fill=TEXT_WHITE)
    
    f_sub = get_font(30, bold=False)
    sub = "One difference. One clock."
    b_sub = draw.textbbox((0, 0), sub, font=f_sub)
    draw.text(((CANVAS_W - (b_sub[2] - b_sub[0])) // 2, 190), sub, font=f_sub, fill=TEXT_MUTED)
    
    # Frame & Gameplay Screenshot
    # We crop the gameplay screenshot to focus on the active timer & photo gameboard
    raw_shot = Image.open(GAMEPLAY_SHOT) # 1242 x 2688
    # Center crop the relevant middle gameplay portion (timer + image pair)
    # y from ~300 to ~2200
    shot_cropped = raw_shot.crop((40, 340, 1202, 2200))
    target_w = 680
    target_h = int(target_w * shot_cropped.height / shot_cropped.width)
    shot_resized = shot_cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    shot_x = (CANVAS_W - target_w) // 2
    shot_y = 260
    
    # Card container with shadow/bezel
    draw.rounded_rectangle([shot_x - 10, shot_y - 10, shot_x + target_w + 10, shot_y + target_h + 10], radius=28, fill=BORDER_COLOR)
    mask = Image.new("L", (target_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, target_w, target_h], radius=24, fill=255)
    slide.paste(shot_resized, (shot_x, shot_y), mask)
    
    # Bottom caption
    f_bot = get_font(26, bold=True)
    bot_text = "Swipe to see the leaderboard  →"
    b_bot = draw.textbbox((0, 0), bot_text, font=f_bot)
    draw.text(((CANVAS_W - (b_bot[2] - b_bot[0])) // 2, shot_y + target_h + 35), bot_text, font=f_bot, fill=ACCENT_CYAN)
    
    out_path = os.path.join(OUTPUT_DIR, "slide_2_gameplay.png")
    slide.save(out_path, quality=95)
    print("Saved:", out_path)

# ==========================================
# SLIDE 3: LEADERBOARD COMPETITION
# ==========================================
def render_slide_3():
    slide = create_base_canvas()
    draw = ImageDraw.Draw(slide)
    
    # Top text
    top_label = "COMPETITION"
    f_top = get_font(24, bold=True)
    b_top = draw.textbbox((0, 0), top_label, font=f_top)
    draw.text(((CANVAS_W - (b_top[2] - b_top[0])) // 2, 70), top_label, font=f_top, fill=ACCENT_BLUE)
    
    f_head = get_font(58, bold=True)
    h1 = "HOW FAST ARE YOU, REALLY?"
    b_h1 = draw.textbbox((0, 0), h1, font=f_head)
    draw.text(((CANVAS_W - (b_h1[2] - b_h1[0])) // 2, 115), h1, font=f_head, fill=TEXT_WHITE)
    
    f_sub = get_font(30, bold=False)
    sub = "Find your place on the leaderboard."
    b_sub = draw.textbbox((0, 0), sub, font=f_sub)
    draw.text(((CANVAS_W - (b_sub[2] - b_sub[0])) // 2, 190), sub, font=f_sub, fill=TEXT_MUTED)
    
    # Leaderboard screenshot
    raw_lead = Image.open(LEADERBOARD_SHOT) # 1242 x 2688
    # Crop to prominent scores and ranks
    lead_cropped = raw_lead.crop((40, 360, 1202, 2250))
    target_w = 680
    target_h = int(target_w * lead_cropped.height / lead_cropped.width)
    lead_resized = lead_cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
    
    lead_x = (CANVAS_W - target_w) // 2
    lead_y = 260
    
    draw.rounded_rectangle([lead_x - 10, lead_y - 10, lead_x + target_w + 10, lead_y + target_h + 10], radius=28, fill=BORDER_COLOR)
    mask = Image.new("L", (target_w, target_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, target_w, target_h], radius=24, fill=255)
    slide.paste(lead_resized, (lead_x, lead_y), mask)
    
    # Bottom callout
    f_bot = get_font(26, bold=True)
    bot_text = "Swipe for the answer reveal"
    b_bot = draw.textbbox((0, 0), bot_text, font=f_bot)
    bw = b_bot[2] - b_bot[0]
    bx = (CANVAS_W - bw - 35) // 2
    draw.text((bx, lead_y + target_h + 35), bot_text, font=f_bot, fill=ACCENT_CYAN)
    draw_arrow_right(draw, bx + bw + 24, lead_y + target_h + 49, size=10, color=ACCENT_CYAN, width=3)
    
    out_path = os.path.join(OUTPUT_DIR, "slide_3_leaderboard.png")
    slide.save(out_path, quality=95)
    print("Saved:", out_path)

# ==========================================
# SLIDE 4: THE ANSWER REVEAL
# ==========================================
def render_slide_4():
    slide = create_base_canvas()
    draw = ImageDraw.Draw(slide)
    
    # 1. Top label
    top_label = "THE REVEAL"
    f_top = get_font(24, bold=True)
    b_top = draw.textbbox((0, 0), top_label, font=f_top)
    draw.text(((CANVAS_W - (b_top[2] - b_top[0])) // 2, 85), top_label, font=f_top, fill=ACCENT_GREEN)
    
    # 2. Main headline
    f_head = get_font(68, bold=True)
    l1 = "DID YOU SPOT IT?"
    b1 = draw.textbbox((0, 0), l1, font=f_head)
    draw.text(((CANVAS_W - (b1[2] - b1[0])) // 2, 140), l1, font=f_head, fill=TEXT_WHITE)
    
    f_sub = get_font(32, bold=False)
    sub = "The difference was right here."
    b_sub = draw.textbbox((0, 0), sub, font=f_sub)
    draw.text(((CANVAS_W - (b_sub[2] - b_sub[0])) // 2, 225), sub, font=f_sub, fill=ACCENT_CYAN)
    
    # 3. Two puzzle images side by side
    puz_w, puz_h = 455, 640
    im_a = Image.open(BASE_IMG_PATH).resize((puz_w, puz_h), Image.Resampling.LANCZOS)
    im_b = Image.open(ALT_IMG_PATH).resize((puz_w, puz_h), Image.Resampling.LANCZOS)
    
    draw.rounded_rectangle([68, 328, 68 + puz_w + 4, 328 + puz_h + 4], radius=16, fill=BORDER_COLOR)
    draw.rounded_rectangle([553, 328, 553 + puz_w + 4, 328 + puz_h + 4], radius=16, fill=BORDER_COLOR)
    
    mask = Image.new("L", (puz_w, puz_h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, puz_w, puz_h], radius=14, fill=255)
    slide.paste(im_a, (70, 330), mask)
    slide.paste(im_b, (555, 330), mask)
    
    # Circle the changed area on Image B (Display Item Removed at 22.3%, 53.2%)
    circ_x = 555 + int(0.223 * puz_w)
    circ_y = 330 + int(0.532 * puz_h)
    r = 38
    
    # Glowing answer ring
    for glow in range(8, 0, -2):
        draw.ellipse([circ_x - r - glow, circ_y - r - glow, circ_x + r + glow, circ_y + r + glow], outline=(74, 222, 128, 60), width=2)
    draw.ellipse([circ_x - r, circ_y - r, circ_x + r, circ_y + r], outline=ACCENT_GREEN, width=4)
    
    # Indicator label with arrow
    f_ind = get_font(24, bold=True)
    ind_text = "Window Item Removed"
    b_ind = draw.textbbox((0, 0), ind_text, font=f_ind)
    ind_w = b_ind[2] - b_ind[0]
    box_w = ind_w + 50
    draw.rounded_rectangle([circ_x - box_w // 2, circ_y + r + 15, circ_x + box_w // 2, circ_y + r + 55], radius=10, fill=(15, 23, 42, 230), outline=ACCENT_GREEN, width=2)
    draw.text((circ_x - box_w // 2 + 16, circ_y + r + 22), ind_text, font=f_ind, fill=TEXT_WHITE)
    draw_arrow_up(draw, circ_x + box_w // 2 - 16, circ_y + r + 24, size=8, color=ACCENT_GREEN, width=3)
    
    # Bottom callout
    f_sw = get_font(28, bold=True)
    sw_text = "Ready to play real puzzles?"
    b_sw = draw.textbbox((0, 0), sw_text, font=f_sw)
    sw_w = b_sw[2] - b_sw[0]
    pill_w = sw_w + 90
    pill_x = (CANVAS_W - pill_w) // 2
    draw.rounded_rectangle([pill_x, 1025, pill_x + pill_w, 1095], radius=35, fill=(30, 41, 59))
    draw.rounded_rectangle([pill_x, 1025, pill_x + pill_w, 1095], radius=35, outline=ACCENT_BLUE, width=2)
    draw.text((pill_x + 32, 1044), sw_text, font=f_sw, fill=TEXT_WHITE)
    draw_arrow_right(draw, pill_x + pill_w - 30, 1060, size=12, color=ACCENT_BLUE, width=3)
    
    out_path = os.path.join(OUTPUT_DIR, "slide_4_reveal.png")
    slide.save(out_path, quality=95)
    print("Saved:", out_path)

# ==========================================
# SLIDE 5: LAUNCH ANNOUNCEMENT & CTA
# ==========================================
def render_slide_5():
    slide = create_base_canvas()
    draw = ImageDraw.Draw(slide)
    
    # 1. App Icon at top
    icon_size = 200
    raw_icon = Image.open(APP_ICON_PATH).resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    icon_x = (CANVAS_W - icon_size) // 2
    icon_y = 100
    
    # Rounded mask for app icon
    icon_mask = Image.new("L", (icon_size, icon_size), 0)
    ImageDraw.Draw(icon_mask).rounded_rectangle([0, 0, icon_size, icon_size], radius=44, fill=255)
    
    # Shadow/Border around icon
    draw.rounded_rectangle([icon_x - 6, icon_y - 6, icon_x + icon_size + 6, icon_y + icon_size + 6], radius=48, fill=BORDER_COLOR)
    slide.paste(raw_icon, (icon_x, icon_y), icon_mask)
    
    # 2. Headline
    f_head = get_font(68, bold=True)
    head_text = "DIFF HUNTER IS LIVE."
    b_head = draw.textbbox((0, 0), head_text, font=f_head)
    draw.text(((CANVAS_W - (b_head[2] - b_head[0])) // 2, 340), head_text, font=f_head, fill=TEXT_WHITE)
    
    f_sub = get_font(32, bold=False)
    sub = "The ultimate visual speed challenge."
    b_sub = draw.textbbox((0, 0), sub, font=f_sub)
    draw.text(((CANVAS_W - (b_sub[2] - b_sub[0])) // 2, 425), sub, font=f_sub, fill=TEXT_MUTED)
    
    # 3. Platform Availability Cards
    platforms = [
        ("Apple iOS / iPhone", "OUT NOW", ACCENT_GREEN),
        ("Web Browser", "PLAY NOW", ACCENT_CYAN),
        ("Android (Google Play)", "COMING SOON", (251, 191, 36)) # Amber 400
    ]
    
    card_w = 680
    card_h = 90
    card_x = (CANVAS_W - card_w) // 2
    start_y = 520
    
    f_plat = get_font(30, bold=True)
    f_badge = get_font(20, bold=True)
    
    for i, (name, status, badge_color) in enumerate(platforms):
        cy = start_y + i * 115
        draw.rounded_rectangle([card_x, cy, card_x + card_w, cy + card_h], radius=20, fill=CARD_BG, outline=BORDER_COLOR, width=2)
        
        # Platform Name
        draw.text((card_x + 35, cy + 26), name, font=f_plat, fill=TEXT_WHITE)
        
        # Badge
        b_box = draw.textbbox((0, 0), status, font=f_badge)
        b_w = b_box[2] - b_box[0]
        badge_pad = 18
        bx2 = card_x + card_w - 30
        bx1 = bx2 - b_w - badge_pad * 2
        draw.rounded_rectangle([bx1, cy + 22, bx2, cy + card_h - 22], radius=12, fill=(20, 30, 48), outline=badge_color, width=2)
        draw.text((bx1 + badge_pad, cy + 31), status, font=f_badge, fill=badge_color)
    
    # 4. Big CTA Button at bottom
    f_cta = get_font(36, bold=True)
    cta_text = "PLAY NOW  ·  LINK IN BIO"
    b_cta = draw.textbbox((0, 0), cta_text, font=f_cta)
    cta_w = b_cta[2] - b_cta[0]
    
    btn_w = 740
    btn_h = 95
    btn_x = (CANVAS_W - btn_w) // 2
    btn_y = 940
    
    # Glowing gradient/outline button
    draw.rounded_rectangle([btn_x - 3, btn_y - 3, btn_x + btn_w + 3, btn_y + btn_h + 3], radius=48, fill=ACCENT_BLUE)
    draw.rounded_rectangle([btn_x, btn_y, btn_x + btn_w, btn_y + btn_h], radius=45, fill=(14, 165, 233))
    draw.text(((CANVAS_W - cta_w) // 2, btn_y + 24), cta_text, font=f_cta, fill=(255, 255, 255))
    
    # 5. Hashtags reminder at bottom
    f_hash = get_font(22, bold=False)
    hash_text = "#DiffHunter   #SpotTheDifference   #VisualChallenge"
    b_hash = draw.textbbox((0, 0), hash_text, font=f_hash)
    draw.text(((CANVAS_W - (b_hash[2] - b_hash[0])) // 2, 1150), hash_text, font=f_hash, fill=(100, 116, 139))
    
    out_path = os.path.join(OUTPUT_DIR, "slide_5_launch_cta.png")
    slide.save(out_path, quality=95)
    print("Saved:", out_path)

if __name__ == "__main__":
    render_slide_1()
    render_slide_2()
    render_slide_3()
    render_slide_4()
    render_slide_5()
    print("All 5 launch carousel slides generated successfully!")
