---
name: Premium Lifestyle Quick-Commerce
colors:
  surface: '#f4fbf4'
  surface-dim: '#d4dcd5'
  surface-bright: '#f4fbf4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eef6ee'
  surface-container: '#e8f0e9'
  surface-container-high: '#e3eae3'
  surface-container-highest: '#dde4dd'
  on-surface: '#161d19'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2b322d'
  inverse-on-surface: '#ebf3eb'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#855300'
  on-secondary: '#ffffff'
  secondary-container: '#fea619'
  on-secondary-container: '#684000'
  tertiary: '#a43a3a'
  on-tertiary: '#ffffff'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#f4fbf4'
  on-background: '#161d19'
  surface-variant: '#dde4dd'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  unit: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin-mobile: 20px
  margin-desktop: 40px
---

## Brand & Style

The design system is engineered for a high-end, rapid-delivery experience that balances urgency with an effortless lifestyle aesthetic. The brand personality is **inviting, optimistic, and ultra-reliable**, moving away from the chaotic energy of traditional logistics toward a curated, "premium-concierge" feel. 

The visual style utilizes **Soft Minimalism** with a **Premium Lifestyle** overlay. It leans heavily into organic geometric shapes, maximum roundedness, and a light-filled interface. By using a "Dash Green" seed color against a vast landscape of whitespace, the system communicates freshness—essential for grocery and local commerce—while maintaining a sophisticated edge through meticulous typography and subtle depth.

## Colors

The palette is anchored by **Dash Green (#10B981)**, a vibrant, high-chroma emerald that signals both ecological freshness and "go-signal" speed. This is supported by a sophisticated neutral scale starting from a crisp white surface to a very soft off-white background (#FAFAFA) to maintain depth without using heavy lines.

- **Primary:** Used for the main action path, brand identifiers, and success states.
- **Secondary (Warning):** An amber hue used for "In Progress" or "Pending" states.
- **Neutrals:** Text Primary (#111827) provides high-contrast legibility, while Text Secondary (#6B7280) is reserved for metadata and placeholder text.
- **System States:** Error and Success follow standard semantic patterns but are adjusted to match the vibrance of the primary brand color.

## Typography

This design system utilizes **Plus Jakarta Sans** across all roles to maintain a cohesive, friendly, and modern geometric feel. The typeface’s open apertures and soft curves complement the pill-shaped UI components.

- **Headlines:** Use Bold (700) or ExtraBold (800) weights with slight negative letter spacing to create a punchy, editorial look.
- **Body:** Set primarily in Medium (500) for better legibility on mobile screens against vibrant backgrounds.
- **Labels:** Used for buttons, badges, and overlines, emphasizing a semi-bold weight to ensure they stand out as interactive or informative anchors.

## Layout & Spacing

The layout is built on a strict **8pt grid system**, ensuring visual harmony and mathematical consistency across all screen sizes. 

- **Mobile First:** A fluid grid with 20px side margins and 16px gutters. Most content cards should span the full width or be arranged in a 2-column horizontal scroll.
- **Rhythm:** Use `16px (md)` for standard padding within cards and `24px (lg)` for vertical section spacing. 
- **Touch Targets:** All interactive elements maintain a minimum hit area of 44x44px, often expanded by the pill-shape geometry.

## Elevation & Depth

To align with the **Premium** aesthetic, the design system avoids heavy borders and instead uses **Ambient Shadows** and **Tonal Layering**.

- **Level 0 (Background):** #FAFAFA.
- **Level 1 (Cards/Surfaces):** White (#FFFFFF) with a very soft, diffused shadow: `0px 4px 20px rgba(0, 0, 0, 0.04)`.
- **Level 2 (Interactive/Floating):** Used for Primary Buttons and Bottom Nav. Shadow is more pronounced but remains tinted by the primary color: `0px 8px 24px rgba(16, 185, 129, 0.15)`.
- **Level 3 (Modals/Sheets):** High diffusion to create a "floating over" effect, usually accompanied by a 40% opacity black backdrop blur.

## Shapes

The shape language is the defining characteristic of the design system. We utilize **Maximum Roundedness (Pill-shaped)** to evoke a sense of friendliness, safety, and modernism.

- **Buttons & Search Bars:** Full pill-shape (radius: 999px).
- **Standard Cards:** 24px - 32px (`rounded-lg` or `rounded-xl`) to create a soft, container-like feel.
- **Small Elements:** 12px for badges and tags to ensure they don't look "sharp" next to larger pill shapes.

## Components

### Buttons
- **Primary:** Full-width pill shape, Dash Green background, White text. Bold 16px font. 
- **Secondary:** White background with a 1.5px Dash Green border or a soft green tint (5% opacity).

### Search Bar
- Pill-shaped with a 16px left-aligned search icon. Placeholder text in Text Secondary. Surface color is typically a light grey (#F3F4F6) to contrast against the white background.

### Product Cards
- **Vertical:** Image at the top with 24px corner radius, followed by product name (Headline-md), price (Primary color, Bold), and a circular "+" add button in the bottom right.
- **Horizontal:** Used for cart items or "Quick-Adds." Features a smaller 80x80px image on the left.

### Category Cards
- Square-ish with 24px radius. Features a centered icon or high-quality product photo with a Label-lg below it. Backgrounds can be subtly tinted to match the category (e.g., light pink for "Meat," light yellow for "Fruit").

### Bottom Navigation
- A floating white pill or a docked blur-effect bar. Icons use 2px stroke weight. The active state uses the Primary Green for the icon and a small dot indicator below.

### Status Badges
- Small pill shapes with low-opacity background tints of the semantic color (Success, Warning, Error) and high-opacity text of the same hue.

### Quantity Steppers
- A horizontal pill containing a minus icon, the quantity (Text Primary), and a plus icon. High tactile feedback with soft shadows.

### Order Tracking Timeline
- A vertical line with "pulsing" green nodes for the active state and muted grey nodes for upcoming steps. Uses high-contrast typography for the "Expected Time."