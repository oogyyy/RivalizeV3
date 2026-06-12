'use client'

import { useState } from 'react'
import { MessageCircle, X, Send, CheckCircle } from 'lucide-react'

interface FeedbackData {
  type: 'bug' | 'suggestion' | 'other'
  title: string
  description: string
  email?: string
}

export default function FeedbackBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState<FeedbackData>({
    type: 'suggestion',
    title: '',
    description: '',
    email: '',
  })

  const open = () => {
    setIsOpen(true)
    setIsSubmitted(false)
  }

  const close = () => {
    setIsOpen(false)
    // Reset form after close animation
    setTimeout(() => {
      setIsSubmitted(false)
      setFormData({ type: 'suggestion', title: '', description: '', email: '' })
    }, 200)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.description.trim()) return

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed')
    } catch {
      setIsSubmitting(false)
      return
    }

    setIsSubmitting(false)
    setIsSubmitted(true)

    // Auto-close after showing success
    setTimeout(() => {
      close()
    }, 2200)
  }

  const updateField = (field: keyof FeedbackData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  return (
    <>
      {/* Floating Bubble Button */}
      <button
        onClick={open}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 52,
          height: 52,
          borderRadius: '9999px',
          background: 'linear-gradient(135deg, #ff2d78, #9b1dff)',
          border: 'none',
          boxShadow: '0 8px 32px rgba(255, 45, 120, 0.35), 0 4px 16px rgba(0,0,0,0.3)',
          cursor: 'pointer',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)'
          e.currentTarget.style.boxShadow = '0 12px 40px rgba(255, 45, 120, 0.45)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(255, 45, 120, 0.35), 0 4px 16px rgba(0,0,0,0.3)'
        }}
        aria-label="Open feedback form"
      >
        <MessageCircle size={24} color="white" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={close}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 420,
              margin: '0 16px',
              background: 'rgba(14,13,35,0.98)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14,
              boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: 'linear-gradient(135deg, #ff2d78, #9b1dff)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <MessageCircle size={15} color="white" />
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-inter, Inter), sans-serif',
                    fontSize: 15,
                    fontWeight: 600,
                    color: '#fff',
                  }}
                >
                  Send Feedback
                </span>
              </div>
              <button
                onClick={close}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.5)',
                  cursor: 'pointer',
                  padding: 4,
                }}
                aria-label="Close feedback"
              >
                <X size={18} />
              </button>
            </div>

            {!isSubmitted ? (
              <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
                {/* Type */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: 6,
                    }}
                  >
                    Type
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => updateField('type', e.target.value as FeedbackData['type'])}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  >
                    <option value="suggestion">Feature Suggestion</option>
                    <option value="bug">Bug Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Title */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: 6,
                    }}
                  >
                    Title (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateField('title', e.target.value)}
                    placeholder="Short summary"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Description */}
                <div style={{ marginBottom: 16 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: 6,
                    }}
                  >
                    Description *
                  </label>
                  <textarea
                    required
                    value={formData.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    placeholder="Please describe the issue or your idea in detail..."
                    rows={5}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: 14,
                      resize: 'vertical',
                      minHeight: 110,
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                </div>

                {/* Email (optional) */}
                <div style={{ marginBottom: 20 }}>
                  <label
                    style={{
                      display: 'block',
                      fontSize: 12,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.6)',
                      marginBottom: 6,
                    }}
                  >
                    Email (optional — for follow-up)
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => updateField('email', e.target.value)}
                    placeholder="your@email.com"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      padding: '10px 12px',
                      color: '#fff',
                      fontSize: 14,
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !formData.description.trim()}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: 8,
                    background: isSubmitting || !formData.description.trim()
                      ? 'rgba(255,45,120,0.3)'
                      : 'linear-gradient(135deg, #ff2d78, #9b1dff)',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 600,
                    border: 'none',
                    cursor: isSubmitting || !formData.description.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSubmitting ? 'Sending...' : 'Send Feedback'}
                  {!isSubmitting && <Send size={16} />}
                </button>

                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', marginTop: 12 }}>
                  Your feedback helps us improve Rivalize.
                </p>
              </form>
            ) : (
              <div style={{ padding: '40px 24px', textAlign: 'center' }}>
                <CheckCircle size={48} color="#2DE3CE" style={{ marginBottom: 16 }} />
                <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
                  Thank you!
                </h3>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.5 }}>
                  We've received your feedback and will review it soon.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
