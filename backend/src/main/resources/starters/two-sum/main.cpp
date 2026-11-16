#include <bits/stdc++.h>
using namespace std;

// Return {i, j} with i < j and nums[i] + nums[j] == target.
pair<int, int> solve(const vector<int>& nums, long long target) {
    // TODO: write your algorithm here
    return {-1, -1};
}

int main() {
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int n;
    cin >> n;
    vector<int> nums(n);
    for (auto& x : nums) cin >> x;
    long long target;
    cin >> target;
    auto [i, j] = solve(nums, target);
    cout << i << ' ' << j << '\n';
    return 0;
}
