#include <bits/stdc++.h>
using namespace std;

// Return the largest sum of any k consecutive elements.
long long solve(const vector<int>& nums, long long k) {
    // TODO: write your algorithm here
    return 0;
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    long long k;
    cin >> n >> k;
    vector<int> nums(n);
    for (auto& x : nums) cin >> x;
    cout << solve(nums, k) << '\n';
    return 0;
}
