#include <bits/stdc++.h>
using namespace std;

// For each day, return how many days until a warmer one (0 if none).
vector<int> solve(const vector<int>& temps) {
    // TODO: write your algorithm here
    return vector<int>(temps.size(), 0);
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<int> temps(n);
    for (auto& x : temps) cin >> x;
    vector<int> ans = solve(temps);
    for (size_t i = 0; i < ans.size(); i++) cout << (i ? " " : "") << ans[i];
    cout << '\n';
    return 0;
}
