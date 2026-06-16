from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageFont
import math, random

# ---- LOAD AI-GENERATED IMAGE ----
ai_img = Image.open(r'E:\Bilibili video download\image_001.jpg').convert('RGBA')
print(f"AI image: {ai_img.size}")

# Resize AI image to fit nicely in the poster (center, large)
W, H = 1080, 1440
target_w = 650
target_h = int(target_w * ai_img.height / ai_img.width)
ai_resized = ai_img.resize((target_h, target_h), Image.LANCZOS)

# ---- BACKGROUND ----
bg = Image.new('RGBA', (W, H), (20, 10, 55))
draw = ImageDraw.Draw(bg)

for y in range(H):
    t = y / H
    if t < 0.35:
        r = int(20 + 5 * t / 0.35)
        g = int(8 + 20 * t / 0.35)
        b = int(55 + 80 * t / 0.35)
    elif t < 0.65:
        r = int(25 + 40 * (t-0.35) / 0.3)
        g = int(28 + 45 * (t-0.35) / 0.3)
        b = int(135 + 55 * (t-0.35) / 0.3)
    else:
        r = int(65 + 120 * (t-0.65) / 0.35)
        g = int(73 + 35 * (t-0.65) / 0.35)
        b = int(190 + 30 * (t-0.65) / 0.35)
    xt = (y // 3) % 2
    fr = max(0, min(255, r + (5 if xt else -3)))
    fg = max(0, min(255, g + (8 if xt else -3)))
    fb = max(0, min(255, b + (5 if xt else 0)))
    draw.line([(0, y), (W, y)], fill=(fr, fg, fb))

# ---- STARS ----
random.seed(42)
for _ in range(450):
    x = random.randint(0, W-1)
    y = random.randint(0, H-1)
    sz = random.choice([1,1,1,2,2])
    c = random.choice([(255,255,200),(255,255,255),(200,220,255),(255,220,180),(255,200,220)])
    draw.ellipse([x-sz, y-sz, x+sz, y+sz], fill=c)

for _ in range(35):
    x = random.randint(0, W-1)
    y = random.randint(0, int(H*0.65))
    for dx in range(-4, 5):
        for dy in range(-4, 5):
            nx, ny = x+dx, y+dy
            if 0<=nx<W and 0<=ny<H:
                d = math.sqrt(dx**2+dy**2)
                if d <= 4:
                    orig = bg.getpixel((nx, ny))
                    bg.putpixel((nx, ny), (
                        min(255, orig[0]+90),
                        min(255, orig[1]+70),
                        min(255, orig[2]+50)))

# ---- CONFETTI ----
candy = [(255,100,150),(255,150,100),(100,255,150),(100,200,255),
         (255,255,100),(255,180,220),(180,255,220),(255,220,180),(220,180,255)]
random.seed(777)
for _ in range(220):
    x = random.randint(0, W)
    y = random.randint(0, H)
    c = random.choice(candy)
    sh = random.choice([0,1,2,3])
    sz = random.randint(4, 14)
    if sh == 0:
        draw.ellipse([x-sz,y-sz,x+sz,y+sz], fill=c)
    elif sh == 1:
        draw.polygon([(x,y-sz),(x-sz,y+sz),(x+sz,y+sz)], fill=c)
    elif sh == 2:
        draw.rectangle([x-sz*2,y-sz,x+sz*2,y+sz], fill=c)
    else:
        pts = [(x,y-sz),(x-sz//2,y),(x,y+sz),(x+sz//2,y)]
        draw.polygon(pts, fill=c)

# ---- BALLOON CLUSTERS ----
bal_lo = [(115,440,(255,80,120)),(210,380,(255,155,80)),(285,455,(255,255,80)),
         (90,530,(80,200,255)),(240,580,(100,255,180))]
for bx,by,bc in bal_lo:
    for r in range(42,0,-2):
        ratio = r/42
        cl = (min(255,int(bc[0]*ratio+255*(1-ratio))),
              min(255,int(bc[1]*ratio+255*(1-ratio))),
              min(255,int(bc[2]*ratio+255*(1-ratio))))
        draw.ellipse([bx-r,by-r,bx+r,by+r], fill=cl)
    draw.ellipse([bx-16,by-16,bx-7,by-7], fill=(255,255,255,200))
    for sy in range(by+42, by+88):
        sx = bx+4 + int(4*math.sin((sy-by)*0.18))
        draw.line([(sx,sy),(sx,sy+2)], fill=(180,140,100), width=1)

bal_hi = [(795,410,(255,100,180)),(880,490,(150,100,255)),
          (910,350,(255,200,100)),(845,550,(100,255,220))]
for bx,by,bc in bal_hi:
    for r in range(42,0,-2):
        ratio = r/42
        cl = (min(255,int(bc[0]*ratio+255*(1-ratio))),
              min(255,int(bc[1]*ratio+255*(1-ratio))),
              min(255,int(bc[2]*ratio+255*(1-ratio))))
        draw.ellipse([bx-r,by-r,bx+r,by+r], fill=cl)
    draw.ellipse([bx-16,by-16,bx-7,by-7], fill=(255,255,255,200))
    for sy in range(by+42, by+88):
        sx = bx+4 + int(4*math.sin((sy-by)*0.18))
        draw.line([(sx,sy),(sx,sy+2)], fill=(180,140,100), width=1)

# ---- ROCKET ----
def draw_rocket(d, rx, ry, fc=(255,255,255), ac=(255,70,70)):
    d.polygon([(rx,ry-82),(rx-26,ry+50),(rx+26,ry+50)], fill=fc)
    d.polygon([(rx,ry-82),(rx-15,ry-25),(rx+15,ry-25)], fill=ac)
    d.polygon([(rx-26,ry+28),(rx-50,ry+60),(rx-26,ry+60)], fill=ac)
    d.polygon([(rx+26,ry+28),(rx+50,ry+60),(rx+26,ry+60)], fill=ac)
    d.ellipse([rx-13,ry-16,rx+13,ry+16], fill=(80,180,255))
    d.ellipse([rx-8,ry-11,rx+8,ry+11], fill=(200,240,255))
    d.polygon([(rx-15,ry+50),(rx+15,ry+50),(rx,ry+96)], fill=(255,150,50))
    d.polygon([(rx-7,ry+50),(rx+7,ry+50),(rx,ry+75)], fill=(255,255,100))
draw_rocket(draw, 860, 240)
draw_rocket(draw, 940, 310, fc=(220,220,255), ac=(100,100,255))

# ---- SPARKLES ----
for sx,sy in [(85,280),(285,130),(695,175),(955,325),(35,680),(1025,565),(120,890),(955,840)]:
    for i in range(4):
        ang = i*90+45
        draw.line([(sx,sy),(sx+18*math.cos(math.radians(ang)),sy+18*math.sin(math.radians(ang)))],
                 fill=(255,255,180), width=2)
    for i in range(4):
        ang = i*90
        draw.line([(sx,sy),(sx+9*math.cos(math.radians(ang)),sy+9*math.sin(math.radians(ang)))],
                 fill=(255,255,255), width=1)

# ---- COMPOSE: AI IMAGE CENTER ----
ai_x = (W - target_h) // 2
ai_y = 310
ai_frame = Image.new('RGBA', (target_h + 30, target_h + 30), (0,0,0,0))
frame_draw = ImageDraw.Draw(ai_frame)

# Decorative frame border
for i in range(6):
    alpha = 180 - i * 25
    rect_c = (255, 200, 100, max(30, alpha))
    frame_draw.rounded_rectangle([i*3, i*3, target_h+30-i*3, target_h+30-i*3],
                                  radius=20, outline=rect_c, width=1)

# Place AI image inside frame
ai_frame.paste(ai_resized, (15, 15), ai_resized)
bg.paste(ai_frame, (ai_x, ai_y), ai_frame)

# ---- RAINBOW ARC ----
rb_cx, rb_cy = W//2, H-220
rb_colors = [(255,0,0),(255,127,0),(255,255,0),(0,200,0),(0,0,255),(75,0,130),(148,0,211)]
for i,(r,g,b) in enumerate(rb_colors):
    arc = 148 + i*13
    for ang in range(-52, 53, 1):
        rad = math.radians(ang)
        px = rb_cx + arc*math.cos(rad)
        py = rb_cy + arc*math.sin(rad)
        if 0<=int(px)<W and 0<=int(py)<H:
            orig = bg.getpixel((int(px), int(py)))
            if orig[3] > 200:
                continue
            bg.putpixel((int(px),int(py)),(r,g,b,200))

# ---- TEXT ----
try:
    font_big = ImageFont.truetype(
        "C:/Users/luoke/AppData/Roaming/cc-wrap/skills/canvas-design/canvas-fonts/BebasNeue-Regular.ttf", 115)
    font_mid = ImageFont.truetype(
        "C:/Users/luoke/AppData/Roaming/cc-wrap/skills/canvas-design/canvas-fonts/BebasNeue-Regular.ttf", 62)
    font_small = ImageFont.truetype(
        "C:/Users/luoke/AppData/Roaming/cc-wrap/skills/canvas-design/canvas-fonts/BebasNeue-Regular.ttf", 40)
except:
    font_big = font_mid = font_small = ImageFont.load_default()

# Title shadow + glow
for ox,oy in [(4,4),(4,-4),(-4,4),(-4,-4)]:
    draw.text((W//2+ox, 98+oy), "CHILDREN'S", font=font_big, fill=(80,15,110), anchor="mm")
    draw.text((W//2+ox, 218+oy), "DAY", font=font_big, fill=(80,15,110), anchor="mm")

draw.text((W//2, 94), "CHILDREN'S", font=font_big, fill=(255,255,255), anchor="mm")
draw.text((W//2, 214), "DAY", font=font_big, fill=(255,200,100), anchor="mm")

draw.text((W//2, 296), "HAPPY HOLIDAY", font=font_mid, fill=(255,255,255), anchor="mm")
draw.text((W//2+2, 298), "HAPPY HOLIDAY", font=font_mid, fill=(255,200,220), anchor="mm")

draw.text((W//2, H-65), "INTERNATIONAL CHILDREN'S DAY", font=font_small, fill=(200,220,255), anchor="mm")
draw.text((W//2, H-28), "JUNE 1ST", font=font_small, fill=(255,255,255), anchor="mm")

# ---- SAVE ----
final = bg.convert('RGB')
final.save("E:/Bilibili video download/childrens_day_poster_final.png", "PNG", dpi=(300,300))
print("Done! Saved to childrens_day_poster_final.png")