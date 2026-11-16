#include <bits/stdc++.h>
using namespace std;

// Return nums rotated k places to the right (you may return a new vector).
vector<int> solve(vector<int> nums, long long k) {
    // TODO: write your algorithm here
    return nums;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    long long k;
    cin >> n >> k;
    vector<int> nums(n);
    for (auto& x : nums) cin >> x;
    vector<int> ans = solve(nums, k);
    for (size_t i = 0; i < ans.size(); i++) cout << (i ? " " : "") << ans[i];
    cout << '\n';
    return 0;
}
