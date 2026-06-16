from PIL import Image, ImageDraw, ImageFont
import math, random

W, H = 1080, 1440
img = Image.new("RGB", (W, H), (20, 10, 55))
draw = ImageDraw.Draw(img)

# ---- GRADIENT BACKGROUND ----
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
    fill_r = max(0, min(255, r + (5 if xt else -3)))
    fill_g = max(0, min(255, g + (8 if xt else -3)))
    fill_b = max(0, min(255, b + (5 if xt else 0)))
    draw.line([(0, y), (W, y)], fill=(fill_r, fill_g, fill_b))

# ---- STARS ----
random.seed(42)
for _ in range(500):
    x = random.randint(0, W-1)
    y = random.randint(0, H-1)
    sz = random.choice([1,1,1,2,2])
    a = random.randint(100, 255)
    c = random.choice([(255,255,200),(255,255,255),(200,220,255),(255,220,180),(255,200,220)])
    draw.ellipse([x-sz, y-sz, x+sz, y+sz], fill=c)

for _ in range(40):
    x = random.randint(0, W-1)
    y = random.randint(0, int(H*0.65))
    for dx in range(-4, 5):
        for dy in range(-4, 5):
            nx, ny = x+dx, y+dy
            if 0<=nx<W and 0<=ny<H:
                d = math.sqrt(dx**2+dy**2)
                if d <= 4:
                    a2 = int(255*(1-d/4.5))
                    orig = img.getpixel((nx, ny))
                    img.putpixel((nx, ny), (
                        min(255, orig[0]+100*a2//255),
                        min(255, orig[1]+80*a2//255),
                        min(255, orig[2]+60*a2//255)))

# ---- CONFETTI ----
candy = [(255,100,150),(255,150,100),(100,255,150),(100,200,255),
         (255,255,100),(255,180,220),(180,255,220),(255,220,180),(220,180,255)]
random.seed(777)
for _ in range(250):
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

# ---- BALLOONS LEFT ----
bal_lo = [(165,490,(255,80,120)),(250,430,(255,155,80)),
         (320,505,(255,255,80)),(140,585,(80,200,255)),(285,625,(100,255,180))]
for bx,by,bc in bal_lo:
    for r in range(48,0,-2):
        ratio = r/48
        cl = (min(255,int(bc[0]*ratio+255*(1-ratio))),
              min(255,int(bc[1]*ratio+255*(1-ratio))),
              min(255,int(bc[2]*ratio+255*(1-ratio))))
        draw.ellipse([bx-r,by-r,bx+r,by+r], fill=cl)
    draw.ellipse([bx-20,by-20,bx-10,by-10], fill=(255,255,255,180))
    for sy in range(by+48, by+95):
        sx = bx+4 + int(4*math.sin((sy-by)*0.18))
        draw.line([(sx,sy),(sx,sy+2)], fill=(180,140,100), width=1)

# ---- BALLOONS RIGHT ----
bal_hi = [(805,445,(255,100,180)),(890,525,(150,100,255)),
          (925,385,(255,200,100)),(855,585,(100,255,220))]
for bx,by,bc in bal_hi:
    for r in range(48,0,-2):
        ratio = r/48
        cl = (min(255,int(bc[0]*ratio+255*(1-ratio))),
              min(255,int(bc[1]*ratio+255*(1-ratio))),
              min(255,int(bc[2]*ratio+255*(1-ratio))))
        draw.ellipse([bx-r,by-r,bx+r,by+r], fill=cl)
    draw.ellipse([bx-20,by-20,bx-10,by-10], fill=(255,255,255,180))
    for sy in range(by+48, by+95):
        sx = bx+4 + int(4*math.sin((sy-by)*0.18))
        draw.line([(sx,sy),(sx,sy+2)], fill=(180,140,100), width=1)

# ---- CLOUD ----
cloud_x, cloud_y = W//2, H-280
def draw_cloud(draw, cx, cy, color=(255,255,255), shadow=(220,220,235)):
    ell = [(cx-200,cy,280,90),(cx-100,cy-55,200,105),
           (cx+30,cy-65,210,115),(cx+110,cy-45,170,95),
           (cx-280,cy-25,140,75),(cx+170,cy-20,160,90)]
    for ex,ey,ew,eh in ell:
        draw.ellipse([ex,ey,ex+ew,ey+eh], fill=shadow)
    for ex,ey,ew,eh in ell[1:4]:
        draw.ellipse([ex+12,ey+12,ex+ew-15,ey+eh-8], fill=color)
draw_cloud(draw, cloud_x, cloud_y)

# ---- CHILDREN ----
def draw_child(d, x, y, flip=1, col=(35,18,85)):
    hr=22; bh=52; al=32; ll=48
    d.ellipse([x-hr*flip,y-hr,x+hr*flip,y+hr], fill=col)
    d.rectangle([x-9*flip,y+hr-5,x+9*flip,y+hr+bh], fill=col)
    d.line([(x-9*flip,y+hr+12),(x-al*2*flip,y-hr)], fill=col, width=9)
    d.line([(x+9*flip,y+hr+12),(x+al*flip,y-hr-12)], fill=col, width=9)
    d.line([(x-7*flip,y+hr+bh),(x-22*flip,y+hr+bh+ll)], fill=col, width=9)
    d.line([(x+7*flip,y+hr+bh),(x+27*flip,y+hr+bh+ll)], fill=col, width=9)
draw_child(draw, W//2-90, cloud_y-85)
draw_child(draw, W//2,   cloud_y-118)
draw_child(draw, W//2+95, cloud_y-78)

# ---- ROCKET ----
def draw_rocket(d, rx, ry, fc=(255,255,255), ac=(255,70,70)):
    d.polygon([(rx,ry-90),(rx-28,ry+55),(rx+28,ry+55)], fill=fc)
    d.polygon([(rx,ry-90),(rx-16,ry-28),(rx+16,ry-28)], fill=ac)
    d.polygon([(rx-28,ry+32),(rx-55,ry+65),(rx-28,ry+65)], fill=ac)
    d.polygon([(rx+28,ry+32),(rx+55,ry+65),(rx+28,ry+65)], fill=ac)
    d.ellipse([rx-14,ry-18,rx+14,ry+18], fill=(80,180,255))
    d.ellipse([rx-9,ry-13,rx+9,ry+13], fill=(200,240,255))
    d.polygon([(rx-16,ry+55),(rx+16,ry+55),(rx,ry+105)], fill=(255,150,50))
    d.polygon([(rx-8,ry+55),(rx+8,ry+55),(rx,ry+82)], fill=(255,255,100))
draw_rocket(draw, 840, 220)
draw_rocket(draw, 930, 280, fc=(220,220,255), ac=(100,100,255))

# ---- SPARKLES ----
for sx,sy in [(95,295),(295,145),(705,195),(955,345),
              (45,695),(1025,595),(135,905),(955,855)]:
    for i in range(4):
        ang = i*90+45
        d2 = 18
        draw.line([(sx,sy),(sx+d2*math.cos(math.radians(ang)),sy+d2*math.sin(math.radians(ang)))],
                 fill=(255,255,180), width=2)
    for i in range(4):
        ang = i*90
        draw.line([(sx,sy),(sx+9*math.cos(math.radians(ang)),sy+9*math.sin(math.radians(ang)))],
                 fill=(255,255,255), width=1)

# ---- RAINBOW ----
rb_cx, rb_cy = W//2, H-200
rb_colors = [(255,0,0),(255,127,0),(255,255,0),(0,200,0),(0,0,255),(75,0,130),(148,0,211)]
for i,(r,g,b) in enumerate(rb_colors):
    arc = 165 + i*14
    for ang in range(-55, 56, 1):
        rad = math.radians(ang)
        px = rb_cx + arc*math.cos(rad)
        py = rb_cy + arc*math.sin(rad)
        if 0<=int(px)<W and 0<=int(py)<H:
            img.putpixel((int(px),int(py)),(r,g,b))

# ---- TEXT ----
try:
    font_big = ImageFont.truetype(
        "C:/Users/luoke/AppData/Roaming/cc-wrap/skills/canvas-design/canvas-fonts/BebasNeue-Regular.ttf", 115)
    font_mid = ImageFont.truetype(
        "C:/Users/luoke/AppData/Roaming/cc-wrap/skills/canvas-design/canvas-fonts/BebasNeue-Regular.ttf", 65)
    font_small = ImageFont.truetype(
        "C:/Users/luoke/AppData/Roaming/cc-wrap/skills/canvas-design/canvas-fonts/BebasNeue-Regular.ttf", 42)
except:
    font_big = ImageFont.load_default()
    font_mid = font_big
    font_small = font_big

# Title shadow
draw.text((W//2+4, 104+4), "CHILDREN'S", font=font_big, fill=(80,15,110), anchor="mm")
draw.text((W//2+4, 228+4), "DAY", font=font_big, fill=(80,15,110), anchor="mm")

# Title
draw.text((W//2, 100), "CHILDREN'S", font=font_big, fill=(255,255,255), anchor="mm")
draw.text((W//2, 224), "DAY", font=font_big, fill=(255,200,100), anchor="mm")

# Subtitle
draw.text((W//2+2, 308+2), "HAPPY HOLIDAY", font=font_mid, fill=(255,200,220), anchor="mm")
draw.text((W//2, 306), "HAPPY HOLIDAY", font=font_mid, fill=(255,255,255), anchor="mm")

# Bottom text
draw.text((W//2, H-65), "INTERNATIONAL CHILDREN'S DAY", font=font_small,
          fill=(200,220,255), anchor="mm")
draw.text((W//2, H-28), "JUNE 1ST", font=font_small, fill=(255,255,255), anchor="mm")

img.save("E:/Bilibili video download/childrens_day_poster.png", "PNG", dpi=(300,300))
print("Done! Saved to E:/Bilibili video download/childrens_day_poster.png")