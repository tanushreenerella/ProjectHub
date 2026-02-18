from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
from bson.objectid import ObjectId
from extensions import db

funding_bp = Blueprint('funding', __name__)

funding_collection = db.get_collection('funding_opportunities')
applications_collection = db.get_collection('funding_applications')
investors_collection = db.get_collection('investors')


def _serialize_doc(doc: dict) -> dict:
    if not doc:
        return {}
    out = dict(doc)
    out['id'] = str(out.pop('_id'))
    # convert datetimes to ISO strings
    for k, v in list(out.items()):
        if isinstance(v, datetime):
            out[k] = v.isoformat()
    return out


@funding_bp.route('/opportunities', methods=['GET', 'OPTIONS'])
def list_opportunities():
    category = request.args.get('category')
    stage = request.args.get('stage')
    search = request.args.get('search')

    query = {}
    if category:
        query['category'] = category
    if stage:
        query['stage'] = stage
    if search:
        # basic text search across title, provider, description, tags
        regex = {'$regex': search, '$options': 'i'}
        query['$or'] = [
            {'title': regex},
            {'provider': regex},
            {'description': regex},
            {'tags': regex}
        ]

    docs = list(funding_collection.find(query).sort('deadline', 1))
    results = [_serialize_doc(d) for d in docs]
    return jsonify(results)


@funding_bp.route('/apply', methods=['POST', 'OPTIONS'])
@jwt_required()
def apply():
    # allow CORS preflight to pass without JWT failure
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    data = request.get_json() or {}
    applicant_id = get_jwt_identity()

    opportunity_id = data.get('opportunityId') or data.get('opportunity_id')
    project_id = data.get('projectId') or data.get('project_id')
    requested_amount = data.get('requestedAmount') or data.get('requested_amount')
    proposal = data.get('proposal', '')
    status = data.get('status', 'submitted')

    if not opportunity_id or not project_id or not requested_amount:
        return jsonify({'error': 'Missing required fields'}), 400

    application = {
        'opportunity_id': opportunity_id,
        'applicant_id': applicant_id,
        'project_id': project_id,
        'requested_amount': requested_amount,
        'proposal': proposal,
        'status': status,
        'submitted_at': datetime.utcnow(),
        'created_at': datetime.utcnow()
    }

    res = applications_collection.insert_one(application)
    # PyMongo may add an '_id' ObjectId to the passed dict; remove it before JSON serializing
    application.pop('_id', None)
    application['id'] = str(res.inserted_id)
    # Convert datetimes to ISO strings for JSON
    application['submitted_at'] = application['submitted_at'].isoformat()
    application['created_at'] = application['created_at'].isoformat()

    return jsonify(application), 201


@funding_bp.route('/applications/<user_id>', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_applications(user_id):
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    identity = get_jwt_identity()
    # only allow users to fetch their own applications
    if str(identity) != str(user_id):
        return jsonify({'error': 'Unauthorized'}), 403

    docs = list(applications_collection.find({'applicant_id': user_id}).sort('created_at', -1))
    results = []
    for d in docs:
        item = dict(d)
        item['id'] = str(item.pop('_id'))
        if isinstance(item.get('submitted_at'), datetime):
            item['submitted_at'] = item['submitted_at'].isoformat()
        if isinstance(item.get('created_at'), datetime):
            item['created_at'] = item['created_at'].isoformat()
        results.append(item)

    return jsonify(results)


@funding_bp.route('/investors', methods=['GET', 'OPTIONS'])
def list_investors():
    if request.method == 'OPTIONS':
        return jsonify([]), 200
    docs = list(investors_collection.find({}))
    results = []
    for d in docs:
        item = dict(d)
        item['id'] = str(item.pop('_id'))
        results.append(item)
    return jsonify(results)


def seed_funding_data():
    """Insert sample funding opportunities and investors. Call manually in REPL or add a route to run once."""
    # Only insert if collections are empty
    if funding_collection.count_documents({}) == 0:
        now = datetime.utcnow()
        sample_opps = [
            {
                'title': 'College Innovation Grant',
                'provider': 'University Entrepreneurship Center',
                'amount': '$10,000 - $25,000',
                'deadline': now + timedelta(days=60),
                'category': 'grant',
                'stage': 'ideation',
                'description': 'Funding for student-led startups that solve campus challenges.',
                'eligibility': ['Current students', 'Early-stage startups'],
                'tags': ['grant', 'university'],
                'website': ''
            },
            {
                'title': 'TechStars Student Competition',
                'provider': 'TechStars',
                'amount': '$50,000 + Mentorship',
                'deadline': now + timedelta(days=30),
                'category': 'competition',
                'stage': 'prototype',
                'description': 'National competition for student tech startups.',
                'eligibility': ['Student teams', 'Tech startups'],
                'tags': ['competition', 'mentorship'],
                'website': ''
            },
            {
                'title': 'Alumni Angel Network',
                'provider': 'University Alumni Association',
                'amount': '$25,000 - $100,000',
                'deadline': now + timedelta(days=90),
                'category': 'investor',
                'stage': 'launched',
                'description': 'Angel investment from successful alumni.',
                'eligibility': ['Student founders'],
                'tags': ['angel', 'alumni'],
                'website': ''
            },
            {
                'title': 'Campus Crowdfunding Match',
                'provider': 'ProjectHub',
                'amount': '1:1 Matching up to $10,000',
                'deadline': now + timedelta(days=120),
                'category': 'crowdfunding',
                'stage': 'ideation',
                'description': 'Matching funds for community-validated ideas.',
                'eligibility': ['All students'],
                'tags': ['crowdfunding', 'matching'],
                'website': ''
            },
            {
                'title': 'Regional Startup Accelerator',
                'provider': 'State Startup Fund',
                'amount': '$100,000 + Program',
                'deadline': now + timedelta(days=45),
                'category': 'grant',
                'stage': 'prototype',
                'description': 'Accelerator support for promising student startups.',
                'eligibility': ['Student founders', 'Early revenue preferred'],
                'tags': ['accelerator', 'funding'],
                'website': ''
            }
        ]
        funding_collection.insert_many(sample_opps)

    if investors_collection.count_documents({}) == 0:
        sample_investors = [
            {
                'name': 'Dr. Sarah Chen',
                'company': 'EduTech Ventures',
                'investment_range': '$50K - $500K',
                'bio': 'Former professor turned investor.',
                'focus_areas': ['Education Technology', 'AI Learning'],
                'previous_investments': ['StudySync', 'CampusConnect'],
                'contact_email': 'sarah@edutech.ventures',
                'website': ''
            },
            {
                'name': 'Mark Rodriguez',
                'company': 'Campus Capital',
                'investment_range': '$25K - $250K',
                'bio': 'Specializing in student-focused startups.',
                'focus_areas': ['Campus Solutions', 'Marketplaces'],
                'previous_investments': ['DormEats'],
                'contact_email': 'mark@campus.capital',
                'website': ''
            },
            {
                'name': 'Aisha Malik',
                'company': 'Impact Angels',
                'investment_range': '$10K - $150K',
                'bio': 'Investor focused on social impact.',
                'focus_areas': ['Social Impact', 'Community'],
                'previous_investments': ['GreenDorm'],
                'contact_email': 'aisha@impactangels.com',
                'website': ''
            },
            {
                'name': 'Liam O\'Connor',
                'company': 'TechBridge',
                'investment_range': '$50K - $300K',
                'bio': 'Early-stage tech investor.',
                'focus_areas': ['SaaS', 'Developer Tools'],
                'previous_investments': ['DevFlow'],
                'contact_email': 'liam@techbridge.vc',
                'website': ''
            },
            {
                'name': 'Olivia Park',
                'company': 'Founders Fund',
                'investment_range': '$100K - $1M',
                'bio': 'Growth-stage investor.',
                'focus_areas': ['Marketplaces', 'Growth'],
                'previous_investments': ['MarketMate'],
                'contact_email': 'olivia@foundersfund.com',
                'website': ''
            }
        ]
        investors_collection.insert_many(sample_investors)


@funding_bp.route('/seed', methods=['POST'])
@jwt_required()
def seed_route():
    # simple endpoint to run seed in dev; requires auth
    seed_funding_data()
    return jsonify({'status': 'seeded'})
