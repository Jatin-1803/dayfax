---
name: Logistics Core
colors:
  surface: '#f7f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f7f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#3c4a42'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#6c7a71'
  outline-variant: '#bbcabf'
  surface-tint: '#006c49'
  primary: '#006c49'
  on-primary: '#ffffff'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#4edea3'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#515f74'
  on-tertiary: '#ffffff'
  tertiary-container: '#95a4bb'
  on-tertiary-container: '#2c3a4e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#d5e3fd'
  tertiary-fixed-dim: '#b9c7e0'
  on-tertiary-fixed: '#0d1c2f'
  on-tertiary-fixed-variant: '#3a485c'
  background: '#f7f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
typography:
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 22px
    fontWeight: '700'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  touch-target: 48px
  gutter: 16px
  margin-mobile: 16px
---

## Brand & Style

The design system is engineered for the high-velocity, high-stakes environment of delivery logistics. The target audience—delivery partners—requires a UI that prioritizes cognitive ease and physical accessibility over decorative flair. 

The aesthetic is **Modern Corporate / Utility**, characterized by an uncompromising focus on functional clarity. It borrows the structural discipline of Material Design but enhances it with higher contrast ratios and larger hit zones to accommodate drivers operating in variable lighting conditions (direct sunlight to night-time) and often using the device with one hand. 

The emotional goal is to evoke **Confidence and Reliability**. By using a clean, structured interface with a purposeful primary green, the design system ensures that the most critical information—delivery addresses, earnings, and navigation—is never obscured by visual noise. Every pixel is dedicated to the "Safe" visual identity, ensuring immediate usability and reducing the risk of operational errors.

## Colors

The palette is optimized for outdoor legibility. 

- **Primary Action (#10b981):** Reserved strictly for primary call-to-actions, such as "Accept Order" or "Complete Delivery." It provides a vibrant, high-contrast signal against white backgrounds.
- **Deep Slate (#0f172a):** Used for primary typography and iconography to ensure a contrast ratio exceeding WCAG AAA standards for readability.
- **Surface Strategy:** A layered approach using `Neutral (#f8fafc)` for backgrounds and `Surface Contrast (#ffffff)` for interactive cards. This subtle distinction creates structural depth without requiring heavy shadows.
- **Operational Status:** Success, Warning, and Error colors are slightly deepened to ensure they remain visible and meaningful even on low-quality mobile displays or under heavy glare.

## Typography

This design system utilizes **Plus Jakarta Sans** across all levels to maintain a cohesive, modern, yet approachable feel. The typography is weighted heavily toward the medium and bold end of the spectrum to ensure legibility when the phone is mounted on a dashboard or held at arm's length.

- **Information Hierarchy:** Addresses and Order IDs use `headline-sm` or `headline-md` for immediate scanning.
- **Body Text:** Limited to `body-md` for instructions. Avoid using small captions; the minimum size for critical information is 14px (`label-lg`).
- **Letter Spacing:** Headlines use slight negative tracking for a "locked-in" professional look, while labels use increased tracking for clarity in all-caps scenarios.

## Layout & Spacing

The layout philosophy is a **Fluid Grid** anchored by a strict 4px baseline. 

- **One-Handed Priority:** Critical interactive elements are placed within the "natural thumb zone" (the bottom 60% of the screen). 
- **The 48px Rule:** All interactive elements, including small toggles or back buttons, must have a minimum touch target area of 48x48px to accommodate gloved hands or movement.
- **Rhythm:** We use a `16px (md)` standard gutter for mobile to maximize content real estate while maintaining a clear safety margin. For vertical stacking of cards, a `12px` or `16px` gap is preferred to group related delivery information together.

## Elevation & Depth

This design system avoids complex shadows and skeuomorphism to prevent visual clutter. Instead, it utilizes **Tonal Layers** and **Crisp Outlines**.

- **Surface Levels:** The base background is `Neutral (#f8fafc)`. Interactive cards sit on `Surface Contrast (#ffffff)`.
- **Shadows:** Use a single, highly diffused "Ambient Shadow" (0px 4px 20px, 4% opacity Slate) only for the primary active card (e.g., the current delivery). 
- **Outlines:** All other cards use a subtle 1px border (`#e2e8f0`) to define their boundaries without adding the "weight" of a shadow. This ensures that even in high-glare environments, the physical container of the information is clear.

## Shapes

The shape language is **Rounded**, reflecting a modern and accessible service. 

- **Cards:** Use `rounded-lg` (16px) or `rounded-xl` (24px) for the main delivery cards to create a friendly, approachable container that feels distinct from the hardware edges of the phone.
- **Buttons:** Use a consistent `0.5rem` (8px) radius. This provides enough roundness to feel modern while maintaining a structural, "block-like" presence that suggests stability.
- **Badges/Chips:** Use full pill-shaped rounding to differentiate status indicators from actionable buttons.

## Components

- **Buttons:** Primary buttons must span the full width of the container (minus margins) with a minimum height of 56px. Label text should be `headline-sm` for maximum visibility.
- **Cards:** Delivery cards are the primary vessel of information. They must include a clear header (Order ID), a prominent body (Address), and a footer with the primary action button. Use 24px padding inside cards for a breathable, "safe" feel.
- **Status Badges:** Use a background-tint approach (e.g., 10% opacity of the status color) with high-contrast bold text for status chips like "ON THE WAY" or "PENDING."
- **Input Fields:** Use 56px height fields with a solid 1px slate border. Labels should be persistent and never hidden by placeholder text.
- **Lists:** Use 72px minimum row heights for list items. Every row item must include a chevron or a clear visual cue if it is tappable. 
- **Progress Indicators:** Use a thick (8px) stroke for linear progress bars to ensure they are visible at a glance while driving.