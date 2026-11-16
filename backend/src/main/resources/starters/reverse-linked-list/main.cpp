#include <bits/stdc++.h>
using namespace std;

struct ListNode {
    int val;
    ListNode* next;
    explicit ListNode(int v) : val(v), next(nullptr) {}
};

// Reverse the list in place and return the new head (nullptr for an empty list).
ListNode* solve(ListNode* head) {
    // TODO: write your algorithm here
    return head;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    ListNode dummy(0);
    ListNode* tail = &dummy;
    for (int i = 0; i < n; i++) {
        int v;
        cin >> v;
        tail->next = new ListNode(v);
        tail = tail->next;
    }
    ListNode* node = solve(dummy.next);
    string out;
    // Stop after n nodes: a reversal that leaves a cycle would otherwise print forever.
    for (int i = 0; i < n && node != nullptr; i++, node = node->next) out += to_string(node->val) + " -> ";
    cout << (node == nullptr ? out + "null" : string("ERROR: more nodes than the input had (cycle?)")) << '\n';
    return 0;
}
