# Chatopus

A modern chat application built with Tauri, React, and TypeScript, combining a powerful Rust backend with a responsive React frontend.

## Project Structure & Improvement Plan

### Current Architecture

```
src/
├── app/          # Application routes/pages
├── components/   # React components
│   ├── chat/     # Chat-specific components
│   │   ├── core/       # Core chat components
│   │   ├── content/    # Content rendering components
│   │   ├── actions/    # Message action components
│   │   ├── streaming/  # Streaming-related components
│   │   ├── system/     # System message components
│   │   ├── common/     # Shared components
│   │   ├── hooks/      # Chat-specific hooks
│   │   ├── utils/      # Chat utilities
│   │   └── types/      # TypeScript types
│   ├── settings/ # Settings-related components
│   ├── ui/       # Reusable UI components
│   └── _old/     # Legacy components (to be refactored)
├── config/       # Configuration files
├── contexts/     # React contexts
├── hooks/        # Custom React hooks
├── store/        # State management (Zustand/Jotai)
└── utils/        # Utility functions

src-tauri/        # Rust backend
├── src/
│   ├── apimodels/  # API models and types
│   ├── database/   # Database operations
│   └── migrations/ # Database migrations
```

### Improvement Plan

#### 1. Documentation Improvements

- [x] Component Documentation

  - [x] Add JSDoc comments to chat components
  - [x] Create usage examples
  - [x] Document props and interfaces
  - [x] Create component architecture documentation

- [ ] API Documentation

  - [ ] Document all Rust backend endpoints
  - [ ] Add OpenAPI/Swagger documentation
  - [ ] Include request/response examples

- [x] Architecture Documentation
  - [x] System architecture diagram
  - [x] Component relationships
  - [x] Directory structure
  - [ ] State management patterns

#### 2. Code Organization

- [x] Component Structure

  - [x] Move to feature-based organization
  - [x] Separate streaming components
  - [x] Create clear component boundaries
  - [x] Organize chat components by function
  - [ ] Remove \_old directory after refactoring

- [ ] State Management

  - [ ] Consolidate Zustand/Jotai usage
  - [ ] Create clear state management patterns
  - [ ] Document state update flows
  - [ ] Add type safety improvements

- [x] Utility Functions
  - [x] Create dedicated utility modules
  - [x] Organize by feature
  - [ ] Add proper error handling
  - [ ] Add unit tests

#### 3. Backend Improvements

- [ ] API Structure

  - [ ] Organize routes by feature
  - [ ] Implement proper error handling
  - [ ] Add request validation
  - [ ] Improve response types

- [ ] Database
  - [ ] Document schema design
  - [ ] Add migration documentation
  - [ ] Implement proper error handling
  - [ ] Add database tests

#### 4. Development Experience

- [ ] Setup Guide

  - [ ] Document development environment setup
  - [ ] Add troubleshooting guide
  - [ ] Include common development tasks
  - [ ] Document build process

- [ ] Testing
  - [ ] Add unit tests
  - [ ] Add integration tests
  - [ ] Add end-to-end tests
  - [ ] Set up CI/CD pipeline

## Getting Started

### Prerequisites

- Node.js (v18+)
- Rust (latest stable)
- pnpm
- VS Code (recommended)

### Development Setup

1. Install dependencies:

```bash
pnpm install
```

2. Start development server:

```bash
pnpm tauri dev
```

### Available Scripts

- `pnpm dev` - Start Vite development server
- `pnpm build` - Build the application
- `pnpm preview` - Preview the built application
- `pnpm tauri` - Tauri commands
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues

## Project Standards

### Component Structure

```typescript
// Example component structure
import { type FC } from 'react';

interface ComponentProps {
  // Props documentation
  label: string;
  onClick?: () => void;
}

export const Component: FC<ComponentProps> = ({
  label,
  onClick
}) => {
  return (
    <div onClick={onClick}>
      {label}
    </div>
  );
};
```

### State Management

```typescript
// Example store structure
import { create } from "zustand";

interface Store {
  count: number;
  increment: () => void;
}

export const useStore = create<Store>((set) => ({
  count: 0,
  increment: () => set((state) => ({ count: state.count + 1 })),
}));
```

## Contributing

1. Create a feature branch
2. Make your changes
3. Run tests and linting
4. Submit a pull request

## License

[License details here]
