import pytest

from api.customers.models import Customer
from api.projects.models import Project


@pytest.mark.django_db
@pytest.mark.parametrize("assignment,count,codes", [
    ("all", 3, ["A-FREE-1", "A-FREE-2", "A-TAKEN-1"]),
    ("assigned", 1, ["A-TAKEN-1"]),
    ("unassigned", 2, ["A-FREE-1", "A-FREE-2"]),
])
def test_assignment_filter_and_counts(api, placeholders, assignment, count, codes):
    response = api.request("GET", f'/api/projects/{placeholders["tenant_a_project_id"]}/customers/',
        headers={"Authorization": f'Bearer {placeholders["token_a"]}'}, params={"assignment": assignment})
    assert response.status_code == 200
    data = response.json()
    assert data["count"] == count
    assert [c["customer_code"] for c in data["results"]] == codes
    assert data["assignment_summary"] == data["project_summary"] == {
        "total": 3, "assigned": 1, "unassigned": 2, "unassigned_without_location": 1,
    }


@pytest.mark.django_db
def test_counts_before_search_assignment_and_pagination(api, placeholders):
    project = Project.objects.get(pk=placeholders["tenant_a_project_id"])
    Customer.objects.bulk_create([
        Customer(tenant=project.tenant, project=project, customer_code=f"P-{i:03}", name=f"Paging {i}",
                 address="Market", state="NY", zipcode="10001", latitude=40, longitude=-74)
        for i in range(60)
    ])
    url = f"/api/projects/{project.id}/customers/"
    headers = {"Authorization": f'Bearer {placeholders["token_a"]}'}
    response = api.request("GET", url, headers=headers, params={"assignment": "unassigned", "page": 2})
    data = response.json()
    assert response.status_code == 200
    assert len(data["results"]) == 12
    assert data["count"] == 62
    assert data["assignment_summary"]["total"] == 63
    assert data["assignment_summary"]["unassigned"] == 62
    response = api.request("GET", url, headers=headers, params={"assignment": "assigned", "search": "Paging"})
    data = response.json()
    assert data["count"] == 0
    assert data["assignment_summary"]["unassigned"] == 60
    assert data["project_summary"]["unassigned"] == 62


@pytest.mark.django_db
@pytest.mark.parametrize("target,token,status", [
    ("tenant_a_project_id", "token_a", 200),
    ("tenant_a_project2_id", "token_a", 200),
    ("tenant_b_project_id", "token_a", 404),
    ("tenant_a_project_id", None, 401),
])
def test_assignment_summary_scope(api, placeholders, target, token, status):
    response = api.request("GET", "/api/customers/assignment-summary/",
        headers={"Authorization": f'Bearer {placeholders[token]}'} if token else {},
        params={"project": placeholders[target]})
    assert response.status_code == status
    if status == 200:
        assert response.json()["total"] == (3 if target == "tenant_a_project_id" else 1)


@pytest.mark.django_db
def test_invalid_assignment_rejected_and_route_delete_releases_customers(api, placeholders):
    headers = {"Authorization": f'Bearer {placeholders["token_a"]}'}
    project_id = placeholders["tenant_a_project_id"]
    url = f"/api/projects/{project_id}/customers/"
    response = api.request("GET", url, headers=headers, params={"assignment": "invalid"})
    assert response.status_code == 400
    response = api.request("DELETE", f'/api/routes/{placeholders["tenant_a_route_id"]}/', headers=headers)
    assert response.status_code == 204
    response = api.request("GET", url, headers=headers, params={"assignment": "unassigned"})
    assert response.json()["count"] == 3
    assert response.json()["assignment_summary"]["assigned"] == 0
