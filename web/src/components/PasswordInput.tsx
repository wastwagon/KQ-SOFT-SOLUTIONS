import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'
import Input from './ui/Input'
import Button from './ui/Button'

type PasswordInputProps = {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  placeholder?: string
  required?: boolean
  minLength?: number
  label?: string
  hint?: string
}

export default function PasswordInput({
  id,
  value,
  onChange,
  autoComplete = 'current-password',
  placeholder = 'Enter your password',
  required = true,
  minLength,
  label,
  hint,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <Input
      id={id}
      type={showPassword ? 'text' : 'password'}
      autoComplete={autoComplete}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      minLength={minLength}
      placeholder={placeholder}
      label={label}
      hint={hint}
      leading={<Lock className="h-[18px] w-[18px]" aria-hidden />}
      trailing={
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setShowPassword((v) => !v)}
          className="!min-h-0 p-1 h-auto text-gray-400 hover:text-gray-600"
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          aria-pressed={showPassword}
        >
          {showPassword ? (
            <EyeOff className="h-[18px] w-[18px]" aria-hidden />
          ) : (
            <Eye className="h-[18px] w-[18px]" aria-hidden />
          )}
        </Button>
      }
    />
  )
}
