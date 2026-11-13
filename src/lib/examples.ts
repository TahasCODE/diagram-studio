import type { Diagram } from './model';
import { arrangeNodes } from './model';
export const examples: Record<string, Diagram> = {
  "refund": {
    "nodes": [
      {
        "id": "request",
        "label": "Request refund",
        "x": 16,
        "y": 50
      },
      {
        "id": "review",
        "label": "Review request",
        "x": 49,
        "y": 50
      },
      {
        "id": "approved",
        "label": "Issue refund",
        "x": 82,
        "y": 28
      },
      {
        "id": "declined",
        "label": "Decline refund",
        "x": 82,
        "y": 72
      },
      {
        "id": "timeout",
        "label": "Payment times out",
        "x": 18,
        "y": 78
      },
      {
        "id": "retry",
        "label": "Retry payment",
        "x": 48,
        "y": 81
      }
    ],
    "scenarios": [
      {
        "name": "Approved refund",
        "steps": [
          "request",
          "review",
          "approved"
        ]
      },
      {
        "name": "Declined refund",
        "steps": [
          "request",
          "review",
          "declined"
        ]
      },
      {
        "name": "Retry after a timeout",
        "steps": [
          "request",
          "review",
          "timeout",
          "retry",
          "approved"
        ]
      }
    ],
    "title": "Refunds and Retries"
  },
  "checkout": {
    "nodes": [
      {
        "id": "cart",
        "label": "Submit order",
        "x": 16,
        "y": 45
      },
      {
        "id": "pay",
        "label": "Charge payment",
        "x": 48,
        "y": 45
      },
      {
        "id": "ship",
        "label": "Confirm order",
        "x": 82,
        "y": 22
      },
      {
        "id": "fail",
        "label": "Payment declined",
        "x": 82,
        "y": 50
      },
      {
        "id": "duplicate",
        "label": "Return existing order",
        "x": 48,
        "y": 78
      }
    ],
    "scenarios": [
      {
        "name": "Successful checkout",
        "steps": [
          "cart",
          "pay",
          "ship"
        ]
      },
      {
        "name": "Declined payment",
        "steps": [
          "cart",
          "pay",
          "fail"
        ]
      },
      {
        "name": "Duplicate request",
        "steps": [
          "cart",
          "duplicate"
        ]
      }
    ],
    "title": "Checkout and Payment"
  },
  "webhook": {
    "nodes": [
      {
        "id": "event",
        "label": "Publish event",
        "x": 16,
        "y": 40
      },
      {
        "id": "deliver",
        "label": "Deliver webhook",
        "x": 48,
        "y": 40
      },
      {
        "id": "ack",
        "label": "Receive acknowledgment",
        "x": 82,
        "y": 22
      },
      {
        "id": "wait",
        "label": "Wait before retry",
        "x": 48,
        "y": 75
      },
      {
        "id": "dead",
        "label": "Send to dead-letter queue",
        "x": 82,
        "y": 75
      }
    ],
    "scenarios": [
      {
        "name": "Delivered first time",
        "steps": [
          "event",
          "deliver",
          "ack"
        ]
      },
      {
        "name": "Recovered after timeout",
        "steps": [
          "event",
          "deliver",
          "wait",
          "deliver",
          "ack"
        ]
      },
      {
        "name": "Retries exhausted",
        "steps": [
          "event",
          "deliver",
          "wait",
          "deliver",
          "dead"
        ]
      }
    ],
    "title": "Webhook Delivery"
  }
};

// Sample diagrams use the same arrange action as the editor; saved projects retain their positions.
for (const sample of Object.values(examples)) Object.assign(sample,arrangeNodes(sample,0,900));
