from flask import Blueprint, request, jsonify, url_for
from flask_jwt_extended import jwt_required, get_jwt_identity
import stripe
import os
from datetime import datetime, timedelta
from src.config.database import execute_query, execute_one

# Configure Stripe
stripe.api_key = os.getenv('STRIPE_SECRET_KEY', 'sk_test_your_stripe_key')

payments_bp = Blueprint('payments', __name__)

# Subscription plans
SUBSCRIPTION_PLANS = {
    'pro': {
        'name': 'Pro Plan',
        'price': 9.99,
        'price_id': 'price_pro_monthly',  # Replace with actual Stripe price ID
        'features': [
            'Real-time portfolio tracking',
            'Price alerts',
            'Advanced analytics',
            'Email notifications',
            'Priority support'
        ]
    },
    'premium': {
        'name': 'Premium Plan',
        'price': 19.99,
        'price_id': 'price_premium_monthly',  # Replace with actual Stripe price ID
        'features': [
            'All Pro features',
            'Advanced risk analysis',
            'Custom portfolio strategies',
            'API access',
            'White-label reports',
            'Phone support'
        ]
    }
}

@payments_bp.route('/plans', methods=['GET'])
def get_subscription_plans():
    """Get available subscription plans"""
    return jsonify({'plans': SUBSCRIPTION_PLANS})

@payments_bp.route('/create-checkout-session', methods=['POST'])
@jwt_required()
def create_checkout_session():
    """Create Stripe checkout session for subscription"""
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        plan_type = data.get('plan_type')
        if plan_type not in SUBSCRIPTION_PLANS:
            return jsonify({'error': 'Invalid plan type'}), 400
        
        plan = SUBSCRIPTION_PLANS[plan_type]
        
        # Get user info
        user = execute_one(
            'SELECT email FROM users WHERE id = ?',
            (user_id,)
        )
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Create Stripe checkout session
        try:
            checkout_session = stripe.checkout.Session.create(
                payment_method_types=['card'],
                line_items=[{
                    'price_data': {
                        'currency': 'usd',
                        'product_data': {
                            'name': plan['name'],
                            'description': f"MSTY Millionaire {plan['name']} - Monthly Subscription",
                        },
                        'unit_amount': int(plan['price'] * 100),  # Convert to cents
                        'recurring': {
                            'interval': 'month',
                        },
                    },
                    'quantity': 1,
                }],
                mode='subscription',
                success_url=request.host_url + 'account/subscription?success=true&session_id={CHECKOUT_SESSION_ID}',
                cancel_url=request.host_url + 'account/subscription?canceled=true',
                customer_email=user['email'],
                metadata={
                    'user_id': user_id,
                    'plan_type': plan_type
                }
            )
            
            return jsonify({'checkout_url': checkout_session.url})
            
        except stripe.error.StripeError as e:
            print(f"Stripe error: {e}")
            return jsonify({'error': 'Payment processing error'}), 500
        
    except Exception as e:
        print(f"Create checkout session error: {e}")
        return jsonify({'error': 'Failed to create checkout session'}), 500

@payments_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Handle Stripe webhooks"""
    payload = request.get_data()
    sig_header = request.headers.get('Stripe-Signature')
    endpoint_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, endpoint_secret
        )
    except ValueError:
        print("Invalid payload")
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError:
        print("Invalid signature")
        return jsonify({'error': 'Invalid signature'}), 400
    
    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        handle_successful_payment(session)
    
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        handle_subscription_renewal(invoice)
    
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        handle_subscription_cancellation(subscription)
    
    else:
        print(f"Unhandled event type: {event['type']}")
    
    return jsonify({'status': 'success'})

def handle_successful_payment(session):
    """Handle successful payment from Stripe"""
    try:
        user_id = session['metadata']['user_id']
        plan_type = session['metadata']['plan_type']
        
        # Update user subscription
        expires_at = datetime.now() + timedelta(days=30)  # 30 days from now
        
        execute_query(
            'UPDATE users SET subscription_tier = ?, subscription_expires_at = ? WHERE id = ?',
            (plan_type, expires_at, user_id)
        )
        
        print(f"User {user_id} upgraded to {plan_type}")
        
    except Exception as e:
        print(f"Error handling successful payment: {e}")

def handle_subscription_renewal(invoice):
    """Handle subscription renewal"""
    try:
        customer_id = invoice['customer']
        
        # Get customer from Stripe to find user
        customer = stripe.Customer.retrieve(customer_id)
        user_email = customer['email']
        
        # Find user by email
        user = execute_one(
            'SELECT id FROM users WHERE email = ?',
            (user_email,)
        )
        
        if user:
            # Extend subscription by 30 days
            expires_at = datetime.now() + timedelta(days=30)
            execute_query(
                'UPDATE users SET subscription_expires_at = ? WHERE id = ?',
                (expires_at, user['id'])
            )
            
            print(f"Subscription renewed for user {user['id']}")
        
    except Exception as e:
        print(f"Error handling subscription renewal: {e}")

def handle_subscription_cancellation(subscription):
    """Handle subscription cancellation"""
    try:
        customer_id = subscription['customer']
        
        # Get customer from Stripe to find user
        customer = stripe.Customer.retrieve(customer_id)
        user_email = customer['email']
        
        # Find user by email
        user = execute_one(
            'SELECT id FROM users WHERE email = ?',
            (user_email,)
        )
        
        if user:
            # Downgrade to free tier
            execute_query(
                'UPDATE users SET subscription_tier = ?, subscription_expires_at = NULL WHERE id = ?',
                ('free', user['id'])
            )
            
            print(f"Subscription cancelled for user {user['id']}")
        
    except Exception as e:
        print(f"Error handling subscription cancellation: {e}")

@payments_bp.route('/subscription/status', methods=['GET'])
@jwt_required()
def get_subscription_status():
    """Get current user's subscription status"""
    try:
        user_id = get_jwt_identity()
        
        user = execute_one(
            'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = ?',
            (user_id,)
        )
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        is_active = True
        if user['subscription_expires_at']:
            expires_at = datetime.fromisoformat(user['subscription_expires_at'].replace('Z', '+00:00'))
            is_active = expires_at > datetime.now()
        
        return jsonify({
            'tier': user['subscription_tier'],
            'expires_at': user['subscription_expires_at'],
            'is_active': is_active,
            'features': SUBSCRIPTION_PLANS.get(user['subscription_tier'], {}).get('features', [])
        })
        
    except Exception as e:
        print(f"Get subscription status error: {e}")
        return jsonify({'error': 'Failed to get subscription status'}), 500

@payments_bp.route('/subscription/cancel', methods=['POST'])
@jwt_required()
def cancel_subscription():
    """Cancel user's subscription"""
    try:
        user_id = get_jwt_identity()
        
        # In a real implementation, you'd cancel the Stripe subscription here
        # For demo purposes, we'll just update the database
        
        execute_query(
            'UPDATE users SET subscription_tier = ?, subscription_expires_at = NULL WHERE id = ?',
            ('free', user_id)
        )
        
        return jsonify({'message': 'Subscription cancelled successfully'})
        
    except Exception as e:
        print(f"Cancel subscription error: {e}")
        return jsonify({'error': 'Failed to cancel subscription'}), 500

# Decorator to check subscription tier
def require_subscription(required_tier='pro'):
    """Decorator to require specific subscription tier"""
    def decorator(f):
        def wrapper(*args, **kwargs):
            try:
                user_id = get_jwt_identity()
                
                user = execute_one(
                    'SELECT subscription_tier, subscription_expires_at FROM users WHERE id = ?',
                    (user_id,)
                )
                
                if not user:
                    return jsonify({'error': 'User not found'}), 404
                
                # Check if subscription is active
                if user['subscription_expires_at']:
                    expires_at = datetime.fromisoformat(user['subscription_expires_at'].replace('Z', '+00:00'))
                    if expires_at <= datetime.now():
                        return jsonify({'error': 'Subscription expired'}), 403
                
                # Check tier hierarchy: free < pro < premium
                tier_hierarchy = {'free': 0, 'pro': 1, 'premium': 2}
                user_tier_level = tier_hierarchy.get(user['subscription_tier'], 0)
                required_tier_level = tier_hierarchy.get(required_tier, 1)
                
                if user_tier_level < required_tier_level:
                    return jsonify({
                        'error': f'{required_tier.title()} subscription required',
                        'required_tier': required_tier,
                        'current_tier': user['subscription_tier']
                    }), 403
                
                return f(*args, **kwargs)
                
            except Exception as e:
                print(f"Subscription check error: {e}")
                return jsonify({'error': 'Subscription verification failed'}), 500
        
        wrapper.__name__ = f.__name__
        return wrapper
    return decorator

