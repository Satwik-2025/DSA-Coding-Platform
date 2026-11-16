#include <bits/stdc++.h>
using namespace std;

struct TreeNode {
    int val;
    TreeNode* left;
    TreeNode* right;
    explicit TreeNode(int v) : val(v), left(nullptr), right(nullptr) {}
};

// Return the number of nodes on the longest root-to-leaf path (0 for nullptr).
int solve(TreeNode* root) {
    // TODO: write your algorithm here
    return 0;
}

// Level order: each real node, taken from a queue, consumes the next two tokens as its children.
TreeNode* build(const vector<string>& t) {
    if (t.empty() || t[0] == "null") return nullptr;
    TreeNode* root = new TreeNode(stoi(t[0]));
    queue<TreeNode*> q;
    q.push(root);
    size_t i = 1;
    while (!q.empty() && i < t.size()) {
        TreeNode* node = q.front();
        q.pop();
        if (i < t.size() && t[i] != "null") {
            node->left = new TreeNode(stoi(t[i]));
            q.push(node->left);
        }
        i++;
        if (i < t.size() && t[i] != "null") {
            node->right = new TreeNode(stoi(t[i]));
            q.push(node->right);
        }
        i++;
    }
    return root;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int m;
    cin >> m;
    vector<string> tokens(m);
    for (auto& s : tokens) cin >> s;
    cout << solve(build(tokens)) << '\n';
    return 0;
}
