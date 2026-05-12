---
name: frontend/testing-guide
description: 前端测试编写指南，包括单元测试、集成测试和E2E测试的编写方法和最佳实践
type: methodology
agent: boss-frontend
---

# 前端测试编写指南

## 测试要求（强制）

> **职责边界**：Frontend Agent 是测试的**编写者**，QA Agent 是测试的**验证者**。

### 测试金字塔

| 测试类型 | 占比 | 要求 |
|----------|------|------|
| **单元测试** | ~70% | 每个组件/Hook 必须有测试 |
| **集成测试** | ~20% | 组件交互、状态管理测试 |
| **E2E 测试** | ~10% | **必须编写**，覆盖用户流程 |

## 单元测试编写

### 组件渲染测试

```typescript
// Button.test.tsx
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    screen.getByText('Click').click();
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByText('Click')).toBeDisabled();
  });
});
```

### Hook 测试

```typescript
// useCounter.test.ts
import { renderHook, act } from '@testing-library/react';
import { useCounter } from './useCounter';

describe('useCounter', () => {
  it('initializes with default value', () => {
    const { result } = renderHook(() => useCounter());
    expect(result.current.count).toBe(0);
  });

  it('increments count', () => {
    const { result } = renderHook(() => useCounter());
    act(() => {
      result.current.increment();
    });
    expect(result.current.count).toBe(1);
  });
});
```

### 表单验证测试

```typescript
// LoginForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';

describe('LoginForm', () => {
  it('shows validation error for invalid email', async () => {
    render(<LoginForm />);
    const emailInput = screen.getByLabelText('Email');
    
    await userEvent.type(emailInput, 'invalid-email');
    await userEvent.tab(); // Trigger blur
    
    await waitFor(() => {
      expect(screen.getByText('Invalid email format')).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    
    await userEvent.type(screen.getByLabelText('Email'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Login' }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password123',
      });
    });
  });
});
```

## 集成测试编写

### 组件交互测试

```typescript
// UserList.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UserList } from './UserList';
import { UserProvider } from './UserContext';

describe('UserList integration', () => {
  it('adds new user to list', async () => {
    render(
      <UserProvider>
        <UserList />
      </UserProvider>
    );
    
    // 打开添加用户表单
    await userEvent.click(screen.getByText('Add User'));
    
    // 填写表单
    await userEvent.type(screen.getByLabelText('Name'), 'John Doe');
    await userEvent.type(screen.getByLabelText('Email'), 'john@example.com');
    
    // 提交
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));
    
    // 验证用户出现在列表中
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('john@example.com')).toBeInTheDocument();
    });
  });
});
```

### 状态管理测试

```typescript
// store.test.ts
import { renderHook, act } from '@testing-library/react';
import { useStore } from './store';

describe('Store integration', () => {
  it('updates user state across components', () => {
    const { result } = renderHook(() => useStore());
    
    act(() => {
      result.current.setUser({ id: '1', name: 'Alice' });
    });
    
    expect(result.current.user).toEqual({ id: '1', name: 'Alice' });
    
    act(() => {
      result.current.updateUserName('Bob');
    });
    
    expect(result.current.user?.name).toBe('Bob');
  });
});
```

## E2E 测试编写（必须）

### E2E 测试必须覆盖

- ✅ 创建流程（如：添加数据）
- ✅ 编辑流程（如：修改数据）
- ✅ 删除流程（如：删除数据）
- ✅ 列表展示（如：查看列表）
- ✅ 核心业务流程

### Playwright 示例

```typescript
// e2e/user-management.spec.ts
import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test('complete user CRUD flow', async ({ page }) => {
    await page.goto('/users');
    
    // 创建用户
    await page.click('text=Add User');
    await page.fill('[name="name"]', 'John Doe');
    await page.fill('[name="email"]', 'john@example.com');
    await page.click('button:has-text("Submit")');
    
    // 验证用户出现在列表中
    await expect(page.locator('text=John Doe')).toBeVisible();
    
    // 编辑用户
    await page.click('[aria-label="Edit John Doe"]');
    await page.fill('[name="name"]', 'Jane Doe');
    await page.click('button:has-text("Save")');
    
    // 验证更新
    await expect(page.locator('text=Jane Doe')).toBeVisible();
    await expect(page.locator('text=John Doe')).not.toBeVisible();
    
    // 删除用户
    await page.click('[aria-label="Delete Jane Doe"]');
    await page.click('button:has-text("Confirm")');
    
    // 验证删除
    await expect(page.locator('text=Jane Doe')).not.toBeVisible();
  });
  
  test('displays user list with pagination', async ({ page }) => {
    await page.goto('/users');
    
    // 验证列表加载
    await expect(page.locator('[data-testid="user-list"]')).toBeVisible();
    
    // 测试分页
    await page.click('button:has-text("Next")');
    await expect(page).toHaveURL(/page=2/);
  });
});
```

### Cypress 示例

```typescript
// cypress/e2e/user-management.cy.ts
describe('User Management', () => {
  beforeEach(() => {
    cy.visit('/users');
  });

  it('creates, edits, and deletes a user', () => {
    // 创建
    cy.contains('Add User').click();
    cy.get('[name="name"]').type('John Doe');
    cy.get('[name="email"]').type('john@example.com');
    cy.contains('Submit').click();
    
    // 验证创建
    cy.contains('John Doe').should('be.visible');
    
    // 编辑
    cy.get('[aria-label="Edit John Doe"]').click();
    cy.get('[name="name"]').clear().type('Jane Doe');
    cy.contains('Save').click();
    
    // 验证编辑
    cy.contains('Jane Doe').should('be.visible');
    cy.contains('John Doe').should('not.exist');
    
    // 删除
    cy.get('[aria-label="Delete Jane Doe"]').click();
    cy.contains('Confirm').click();
    
    // 验证删除
    cy.contains('Jane Doe').should('not.exist');
  });
});
```

## 测试最佳实践

### 测试命名
- 使用描述性的测试名称
- 格式：`it('should [expected behavior] when [condition]')`
- 示例：`it('should show error message when email is invalid')`

### 测试隔离
- 每个测试独立运行，不依赖其他测试
- 使用 beforeEach 设置初始状态
- 使用 afterEach 清理副作用

### Mock 策略
- Mock 外部依赖（API、第三方库）
- 不要 Mock 被测试的代码
- 使用 MSW（Mock Service Worker）Mock API

```typescript
// mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  rest.get('/api/users', (req, res, ctx) => {
    return res(
      ctx.json([
        { id: '1', name: 'Alice' },
        { id: '2', name: 'Bob' },
      ])
    );
  }),
];
```

### 边界条件测试
- 空数据：列表为空时的展示
- 错误状态：API 失败时的处理
- 加载状态：数据加载中的展示
- 极限值：最大/最小输入值

### 无障碍测试
```typescript
it('is accessible', async () => {
  const { container } = render(<Button>Click</Button>);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

## 测试覆盖率要求

- 语句覆盖率：≥ 80%
- 分支覆盖率：≥ 75%
- 函数覆盖率：≥ 80%
- 行覆盖率：≥ 80%

运行覆盖率报告：
```bash
npm test -- --coverage
```

## 测试报告格式

实现完成后，在输出中包含：

**测试添加**：
| 类型 | 文件 | 描述 |
|------|------|------|
| 单元测试 | `src/components/Button.test.tsx` | Button 组件渲染和交互测试 |
| 集成测试 | `src/features/users/UserList.test.tsx` | 用户列表增删改查集成测试 |
| **E2E 测试** | `e2e/user-management.spec.ts` | 用户管理完整流程 E2E 测试 |

**测试结果**：
- 通过：25 / 失败：0
- 覆盖率：85%
- E2E 测试：✅ 已编写并通过
